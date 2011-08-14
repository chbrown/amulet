var events = require('events');
var Stream = require('stream').Stream;
var parsing = require('./parsing');
var util = require('util');
exports.root = parsing.root;
exports.parseTemplate = parsing.parseTemplate;

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, function(s) {
    switch (s) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      default: return s;
    }
  });
}

var default_object_proto = ({}).__proto__;
function replaceProto(object, old_proto, new_proto) {
  var current = object;
  for (var i = 0; i < 20; i++) { // sane limit
    if (current.__proto__ === old_proto) {
      current.__proto__ = new_proto;
      break;
    }
    current = current.__proto__;

    if (i === 19) {
      console.error('Could not find proto to replace', object, old_proto, new_proto);
    }
  }
}


// Renderer.prototype.outputError = function(string) {
//   this.stream.emit('error', string);
// };


var StreamRenderer = function(asap) {
  this.asap = asap;
  this.context = {};
  this.callback = function() {};
  
  this.stream = new Stream();
};
StreamRenderer.prototype = new events.EventEmitter();
StreamRenderer.prototype.outputWrite = function(string) {
  this.stream.emit('data', string);
};
StreamRenderer.prototype.outputEnd = function(err) {
  this.stream.emit('end');
  this.callback(err);
};

var StringRenderer = function() {
  this.asap = false; // force this (it would be stupid to do otherwise)
  this.context = {};
  this.callback = function() {};
  
  this.string = '';
};
StringRenderer.prototype = new events.EventEmitter();
StringRenderer.prototype.outputWrite = function(string) {
  // console.log('string_outputWrite');
  this.string += string;
};
StringRenderer.prototype.outputEnd = function(err) {
  // console.log('string_outputEnd', this.string);
  this.callback(err, this.string);
};



// Renderer.prototype.addContext = function(name, value) {
//   this.context[name] = value
//   this.emit('bump')
//   return this // chainable
// }
StreamRenderer.prototype.extendContext = 
StringRenderer.prototype.extendContext = 
function(obj) {
  for (attr in obj) {
    this.context[attr] = obj[attr];
  }
  this.emit('bump');
  return this; // chainable
};
StreamRenderer.prototype.force = 
StringRenderer.prototype.force = 
function() {
  // use force to quit waiting for new context variables, and simply leave gaps for missing context variables, where possible
  this.asap = false;
  this.emit('bump');
  return this; // chainable
};
StreamRenderer.prototype.start = 
StringRenderer.prototype.start = 
function(names, context, asap) { // aka render_global
  // if names is 1-long, it can be provided as a simple string (which we normalize to an array here)
  if (!Array.isArray(names)) {
    // console.log('Converting name to 1-list of names');
    names = [names];
  }
  if (context !== undefined) {
    this.extendContext(context);
  }
  if (asap !== undefined) {
    this.asap = asap;
  }
  var renderer = this;
  process.nextTick(function() {
    var tokens = parsing.hitCache(names[0]);
    return renderer.renderTokens(tokens, names.slice(1), renderer.context, function(err) {
      // console.log("Final renderTokens callback called");
      renderer.outputEnd(err);
    });
  });
  return this;
};

StreamRenderer.prototype.renderTokens = 
StringRenderer.prototype.renderTokens = 
function(tokens, yield_names, context, callback) {
  // console.log("Rendering tokens:", util.inspect(tokens, false, null))
  var renderer = this;
  var i = 0;
  (function next() {
    try {
      var token = tokens[i++];

      if (token === undefined) {
        // we're done! (with this scope)
        return callback(undefined);
      }
      if (token === null) {
        // this might have been a token that was optimized out by a parsing post-processor, so just ignore it
        // console.log("Skipping null token in amulet.rendering.renderTokens");
        return next();
      }

      // token = (command, variable, block)
      // console.log(token)
      var command = token[0];
      var variable = token[1];
      if (command === 'raw') {
        renderer.outputWrite(variable);
        return next();
      }
      else if (command === 'partial') {
        // what about partials with variables for names?
        var partial_tokens = parsing.hitCache(variable);
        return renderer.renderTokens(partial_tokens, [], context, next);
      }
      else if (command === 'yield') {
        if (yield_names[0] === undefined) {
          throw new Error('Cannot yield nothing');
        }
        var yield_tokens = parsing.hitCache(yield_names[0]);
        return renderer.renderTokens(yield_tokens, yield_names.slice(1), context, next);
      }
      else {
        (function bump() {
          var item = context, 
              splits = variable.split('.'), 
              next_item = null;
          // console.log("Resolving:", variable)
          // console.log(item)
          for (var i = 0, len = splits.length; i < len; i++) { // foreach split
            next_item = item[splits[i]];
            if (typeof(next_item) === 'function') {
              item = next_item.apply(item); // item(block) ?(block) ? allow parameters?
            }
            else {
              item = next_item;
            }
            
            if (!item) {
              break;
            }
          }
          
          if (item === undefined) {
            // this.asap can be true if we want to wait, 
            // and false if we merely want to ignore the missing contxt variables.
            if (renderer.asap) {
              renderer.once('bump', bump); // wait
              return;
            }
            else {
              item = '';
            }
          }
          else if (item === null) {
            // is this the best idea?
            item = '';
          }

          if (command === 'unescaped') {
            renderer.outputWrite(item.toString());
            return next();
          }
          else if (command === 'escaped') {
            renderer.outputWrite(escapeHtml(item.toString()));
            return next();
          }
          else if (command === 'section' || command === 'inverted_section') {
            var enabled = command === 'inverted_section' ? !item : item;
            if (enabled) {
              var block = token[2];
              function sectionRender(item, context, callback) {
                if (typeof(item) !== 'object') {
                  // for strings, numbers, booleans, etc.
                  item = {'_': item};
                }
                replaceProto(item, default_object_proto, context);
                // stck.push(item)
                
                return renderer.renderTokens(block, [], item, function() {
                  replaceProto(item, context, default_object_proto); // put it back
                  // stck.pop()
                  callback();
                });
              }
            
              if (item instanceof Array) {
                var j = 0;
                (function next2() {
                  var top = item[j++];
                  if (top) {
                    return sectionRender(top, context, next2);
                  }
                  return next();
                })();
              }
              else {
                return sectionRender(item, context, next);
              }
            }
            else {
              // should this be in an else?
              // if it's lower, it'll keep going even if the template below stops for a bump (BAD!)
              return next();
            }
          }
        })();
      }
    } catch (err) {
      // renderer.outputError(err);
      console.error('Amulet error:', err.name, '-->', err.message);
      console.dir(err);
      // throw err;
      // what else can I do?
      next();
    }
  })();
};

exports.StreamRenderer = StreamRenderer;
exports.StringRenderer = StringRenderer;
