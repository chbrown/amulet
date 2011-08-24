var events = require('events'),
    Stream = require('stream').Stream,
    parsing = require('./parsing'),
    util = require('util');
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

var StringRenderer = function(callback) {
  this.asap = false; // force this (it would be stupid to do otherwise)
  this.context = {};
  this.callback = callback;
  
  this.string = '';
};
StringRenderer.prototype = new events.EventEmitter();
StringRenderer.prototype.outputWrite = function(string) {
  this.string += string;
};
StringRenderer.prototype.outputEnd = function(err) {
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
      renderer.outputEnd(err);
    });
  });
  return this;
};

function resolveNodeInContext(context, variable, arguments) {
  // normally, you'll call this with `resolveNodeInContext(context, node.val, node.arguments);`
  var args, item = context, next_item = null, splits = variable.split('.');
  for (var i = 0, len = splits.length; i < len; i++) { // for each split
    next_item = item[splits[i]];
    if (typeof(next_item) === 'function') {
      // console.log("Applying function '" + next_item + "' with args: " + arguments);
      if (arguments) {
        args = arguments.map(function(arg_obj) {
          if (arg_obj.t === 'static') {
            return arg_obj.val;
          }
          else {
            // should I call this with the given context? or the latest one in the dotted chain?
            return resolveNodeInContext(context, arg_obj.val);
          }
        });
        item = next_item.apply(item, args);
      }
      else {
        item = next_item.apply(item);
      }
      // console.log("Result: ", item);
    }
    else {
      item = next_item;
    }
    if (item === undefined || item === null) {
      break;
    }
  }
  return item;
}

StreamRenderer.prototype.renderTokens = 
StringRenderer.prototype.renderTokens = 
function(tokens, yield_names, context, callback) {
  var renderer = this, i = 0;
  (function next() {
    try {
      var node = tokens[i++];

      if (node === undefined) {
        // we're done! (with this scope, at least)
        return callback(undefined);
      }
      if (node === null) {
        // this might have been a node/token that was optimized out by a parsing post-processor, so just ignore it
        // console.log("Skipping null token in amulet.rendering.renderTokens");
        return next();
      }

      if (node.t === 'raw') {
        renderer.outputWrite(node.val);
        return next();
      }
      else if (node.t === 'partial') {
        // xxx: what about partials with context lookups (variables) for names?
        var partial_tokens = parsing.hitCache(node.val);
        return renderer.renderTokens(partial_tokens, [], context, next);
      }
      else if (node.t === 'yield') {
        if (yield_names[0] === undefined) {
          throw new Error('Cannot yield nothing');
        }
        var yield_tokens = parsing.hitCache(yield_names[0]);
        return renderer.renderTokens(yield_tokens, yield_names.slice(1), context, next);
      }
      else {
        (function bump() {
          var item = resolveNodeInContext(context, node.val, node.arguments);
          if (node.filter !== undefined) {
            item = node.filter(item);
            // or, item = node.filter.call(null, item)
            // or, item = node.filter.apply(null, [item])
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

          if (node.t === 'unescaped') {
            renderer.outputWrite(item.toString());
            return next();
          }
          else if (node.t === 'escaped') {
            renderer.outputWrite(escapeHtml(item.toString()));
            return next();
          }
          else if (node.t === 'section' || node.t === 'inverted_section') {
            var enabled = node.t === 'inverted_section' ? !item : item;
            if (enabled) {
              function sectionRender(item, context, callback) {
                if (typeof(item) !== 'object') {
                  // for strings, numbers, booleans, etc.
                  item = {'_': item};
                }
                replaceProto(item, default_object_proto, context);
                
                return renderer.renderTokens(node.block, [], item, function() {
                  replaceProto(item, context, default_object_proto); // put it back
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
