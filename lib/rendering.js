var events = require('events'),
    Stream = require('stream').Stream,
    parsing = require('./parsing'),
    proto = require('./proto');

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

var Renderer = function(context, asap, callback) {
  this.initialize(context, asap, callback);
};
Renderer.prototype = new events.EventEmitter();
Renderer.prototype.initialize = function(context, asap, callback) {
  this.context = context;
  this.asap = asap;
  this.callback = callback;

  this.template_stack = [];
};

Renderer.prototype.extendContext = function(obj, val) {
  if (val !== undefined) {
    this.context[obj] = val;
  }
  else {
    for (var attr in obj) {
      this.context[attr] = obj[attr];
    }
  }
  this.emit('bump');
  return this; // chainable
};
Renderer.prototype.extendTemplateStack = function(templates) {
  Array.prototype.push[Array.isArray(templates) ? 'apply' : 'call'](this.template_stack, templates);
  this.emit('bump');
  return this; // chainable
};
Renderer.prototype.force = function() {
  // use force to quit waiting for new context variables, and simply leave gaps for missing context variables, where possible
  this.asap = false;
  this.emit('bump');
  return this; // chainable
};
Renderer.prototype.start = function(templates, context, asap) { // aka render_global
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

function resolveNodeInContext(context, variable, node_arguments) {
  // normally, you'll call this with `resolveNodeInContext(context, node.val, node.arguments);`
  // for (var i = 0, len = splits.length; i < len; i++) { // for each split
  var item = context;
  variable.split('.').forEach(function(split) {
    var args, next_item = item[split];
    if (typeof(next_item) === 'function') {
      if (node_arguments) {
        args = node_arguments.map(function(arg_obj) {
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
      return;
    }
  });
  return item;
}

Renderer.prototype.renderTokens = function(tokens, context, callback) {
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
          var next_template = renderer.template_stack[0];
          if (next_template === undefined) {
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

          var next_tokens = parsing.hitCache(next_template);
          renderer.template_stack = renderer.template_stack.slice(1);
          return renderer.renderTokens(next_tokens, context, next);
        })();
      }
      else {
        (function bump() {
          var item = resolveNodeInContext(context, node.val, node['arguments']);
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
              var sectionRender = function(local_item, context, callback) {
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

                proto.push(item, context);
                // so now it's item = {cool: 'stuff', __proto__: {original_context_var: 192, __proto__: {}.__proto__}}

                return renderer.renderTokens(node.block, item, function() {
                  proto.pop(item);
                  callback();
                });
              };

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
              // if it's lower, it'll keep going even if the template below stops to wait for a bump (BAD!)
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

var StreamRenderer = function(context, asap, callback) {
  this.initialize(context, asap, callback);
  this.stream = new Stream();
};
StreamRenderer.prototype = new Renderer();
StreamRenderer.prototype.outputWrite = function(string) {
  this.stream.emit('data', string);
};
StreamRenderer.prototype.outputEnd = function(err) {
  this.stream.emit('end');
  this.callback(err);
};

var StringRenderer = function(context, asap, callback) {
  this.initialize(context, asap, callback);
  this.string = '';
};
StringRenderer.prototype = new Renderer();
StringRenderer.prototype.outputWrite = function(string) {
  this.string += string;
};
StringRenderer.prototype.outputEnd = function(err) {
  this.callback(err, this.string);
};

exports.StreamRenderer = StreamRenderer;
exports.StringRenderer = StringRenderer;
