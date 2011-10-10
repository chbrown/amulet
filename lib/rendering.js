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

var base_proto = ({}).__proto__; // base_proto.__proto__ === null
// function replaceProto(object, old_proto, new_proto) {
//   // in most use cases (most often), old_proto === default_object_proto
//   var current = object;
//   for (var i = 0; i < 20; i++) { // sane limit
//     if (current.__proto__ === old_proto) {
//       current.__proto__ = new_proto;
//       break;
//     }
//     current = current.__proto__;
// 
//     if (i === 19) {
//       console.error('Could not find proto to replace', object, old_proto, new_proto);
//     }
//   }
// }

// let's say you have already declared:
//   var default_object_proto = ({}).__proto__;
// when you first declare an object, like so:
//   var context = {first_value: 'yellow world'};
// context.__proto__ will === default_object_proto
// we'll call this depth = 0. That means that if we want to insert a proto on context, 
// we only need to say context.__proto__ = new_proto. That's the ultimate simplest.
// to set it back to the way it was before, we just say context.__proto__ = default_proto // or old_proto
// but after we set that once, depth = 1, and that means that to set a new proto, 
// we'll need to say context.__proto__.__proto__ = new_proto;

function pushProto(object, new_proto) {
  // truncate the object to it's top properties if it doesn't have a __depth indicator
  object.__depth = object.__depth || 0;
  // don't store the object(.__proto__)+ that gets replaced, since we're assuming it === base_proto
  switch (object.__depth) {
    case 0: object.__proto__ = new_proto; break;
    case 1: object.__proto__.__proto__ = new_proto; break;
    case 2: object.__proto__.__proto__.__proto__ = new_proto; break;
    case 3: object.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 4: object.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 5: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 6: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    default: console.log("pushProto doesn't handle protos that deep."); break; // c'mon!
  }
  object.__depth++;
}
function popProto(object) {
  switch (object.__depth) {
    case 0: console.error("Cannot popProto an object with __depth == 0."); break;
    case 1: object.__proto__ = base_proto; break;
    case 2: object.__proto__.__proto__ = base_proto; break;
    case 3: object.__proto__.__proto__.__proto__ = base_proto; break;
    case 4: object.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 5: object.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 6: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 7: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    default: console.log("popProto doesn't handle protos that deep."); break; // c'mon!
  }
  object.__depth--;
}



// Renderer.prototype.outputError = function(string) {
//   this.stream.emit('error', string);
// };


var StreamRenderer = function(asap) {
  this.asap = asap;
  this.context = {};
  this.template_stack = [];
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
  this.asap = false; // force this (it would be stupid/useless to do otherwise)
  this.context = {};
  this.template_stack = [];
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
StreamRenderer.prototype.extendTemplateStack = 
StringRenderer.prototype.extendTemplateStack = 
function(templates) {
  // console.log("\nappending ", templates);
  Array.prototype.push[Array.isArray(templates) ? 'apply' : 'call'](this.template_stack, templates);
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
function(templates, context, asap) { // aka render_global
  this.extendTemplateStack(templates);
  
  if (context !== undefined) {
    this.extendContext(context);
  }
  if (asap !== undefined) {
    this.asap = asap;
  }
  var renderer = this;
  process.nextTick(function() {
    var tokens = parsing.hitCache(renderer.template_stack[0]);
    renderer.template_stack = renderer.template_stack.slice(1);
    return renderer.renderTokens(tokens, renderer.context, function(err) {
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
function(tokens, context, callback) {
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
        // xxx: or partials with yields?
        var partial_tokens = parsing.hitCache(node.val);
        return renderer.renderTokens(partial_tokens, context, next);
      }
      else if (node.t === 'yield') {
        (function bump() {
          if (renderer.template_stack[0] === undefined) {
            // no more templates on the template stack.
            if (renderer.asap) {
              renderer.once('bump', bump); // wait
              return;
            }
            else {
              console.error('Cannot yield nothing. Wait, yes I can.');
              return next();
            }
          }

          var next_tokens = parsing.hitCache(renderer.template_stack[0]);
          renderer.template_stack = renderer.template_stack.slice(1);
          return renderer.renderTokens(next_tokens, context, next);
        })();
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
              // var item_name = node.subsection || '_';
              function sectionRender(local_item, context, callback) {
                // for an object, we DO NOT expose it as _ (problems with circularity)
                // to comply with mu, and for the sake of concision, we expose its properties nakedly
                // however, if there is a subsection name, we box it as that.
                var item;
                if (typeof(local_item) !== 'object' || node.subsection) {
                  // for strings, numbers, booleans, etc. ... or boxed objects
                  item = {};
                  item[node.subsection || '_'] = local_item;
                }
                else {
                  item = local_item;
                }

                pushProto(item, context);
                // so now it's item = {cool: 'stuff', __proto__: {original_context_var: 192, __proto__: {}.__proto__}}
                
                return renderer.renderTokens(node.block, item, function() {
                  popProto(item);
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
      next();
    }
  })();
};

exports.StreamRenderer = StreamRenderer;
exports.StringRenderer = StringRenderer;
