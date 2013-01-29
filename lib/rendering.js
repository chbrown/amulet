var events = require('events'),
    Stream = require('stream').Stream,
    parsing = require('./parsing'),
    proto = require('./proto');

exports.emptyCache = parsing.emptyCache;
exports.set = parsing.set; // a function
exports.parseTemplate = parsing.parseTemplate;

var util = require('util');
function info(/*, objs */) {
  var args = Array.prototype.slice.call(arguments, 0);
  var strings = args.map(function(arg) {
    if (typeof(arg) == 'string')
      return arg;
    return util.inspect(arg, false, null);
  });
  console.log(strings.join(' '));
}

// todo:
//   implement ability to add templates asap-ly, so that the first one
//   can start rendering without its yield being specified yet

exports.render = function(output, templates /*, context, asap, callback*/) {
  // @output: a stream
  // @templates: an array of strings (coerces naked string to 1-array)
  // @context: a string or an array of strings
  // @callback: function(err) { }
  // @asap: boolean that determines how to handle missing variables.
  var args = Array.prototype.slice.call(arguments);
  // pop from the right
  var callback = typeof(args[args.length - 1]) === 'function' ? args.pop() : function() {};
  var asap = typeof(args[args.length - 1]) === 'boolean' ? args.pop() : false;
  var context = args.length > 2 ? args.pop() : {};
  var renderer = new StreamRenderer(context, asap, callback);
  renderer.stream.pipe(output);
  if (templates)
    renderer.start(templates);
  return renderer;
};

exports.renderString = function(names, context, callback) {
  // callback signature: function(err, string)
  // can I force it to be sync? callback is okay too, if not
  var renderer = new StringRenderer(context, false, callback);
  renderer.start(names);
  return renderer;
};

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

function dottedEval(context, expression) {
  // handles strings that occur in context or dotted paths that traverse a context object
  if (expression == '.') return context['.']; // for those embedded sections (silly Mu spec, should be _)

  var parts = expression.split('.');
  for (var i = 0, part; (part = parts[i]) !== undefined; i++) {
    context = context[part];
    if (context === undefined || context === null) break;
  }
  return context;
}

function expressionEval(context, expression) {
  // expression can be a function call, a boolean, or a simple string.
  var m;
  if (m = expression.match(/^(\S+)\s*([!=<>]+)\s*(\S+)$/)) {
    // booleans: ==, ===, !=, !==, <, <=, >, >=
    var left = dottedEval(context, m[1]);
    var op = m[2];
    var right = dottedEval(context, m[3]);
    if (op === '==') return left == right;
    else if (op === '===') return left === right;
    else if (op === '!=') return left != right;
    else if (op === '!==') return left !== right;
    else if (op === '<') return left < right;
    else if (op === '<=') return left <= right;
    else if (op === '>') return left > right;
    else if (op === '>=') return left >= right;
    else throw new Error("Unrecognized operator: " + op);
  }
  else if (m = expression.match(/^(\S+)\((\S*)\)$/)) {
    // functions.
    // open parens indicates function application,
    //   the entire following conditional is for functional application.
    // close_parens_index should be append_to_top.length - 1

    // String.substring takes two indices (not a length)
    // var argument_part = new_node.val.substring(open_parens_index + 1, close_parens_index);
    // trim whitespace/quotes since arguments can only be strings or ints anyway. At least, for now.
    // (todo: let them embed commas in strings)
    // console.log('\nm:', m[1], '(', m[2], ')', context);
    var func = dottedEval(context, m[1]) || eval(m[1]);
    var args = m[2].split(',').map(function(raw) {
      var val = raw.replace(/^\s+|\s+$/g, '');
      if (val.match(/^('|").*\1$/)) { // string literal
        val = val.slice(1, -1);
      }
      else if (val.match(/^-?\d+$/)) { // integer literal
        val = parseInt(val, 10);
      }
      else if (val.match(/^-?\d+\.\d+$/)) { // float literal
        val = parseFloat(val);
      }
      else if (val.match(/^\w+$/)) { // variable reference
        val = dottedEval(context, val);
      }
      return val;
    });

    return func.apply(null, args);
  }
  else {
    return dottedEval(context, expression);
  }
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
  var template_name = renderer.template_stack.shift();
  parsing.hitCache(template_name, function(err, tokens) {
    if (err) console.error(err);
    renderer.renderTokens(tokens, renderer.context, function(err) {
      renderer.outputEnd(err);
    });
  });
  return this;
};
Renderer.prototype.sectionRender = function(node, item, context, callback) {
  // for an object with properties, we DO NOT expose it as _, which causes problems with circularity.
  // to comply with mu, and for the sake of concision, we expose its properties nakedly.
  // however, if there is a sub name, we box it as that.
  var local_item = item;
  if (typeof(item) !== 'object' || node.sub) {
    // for strings, numbers, booleans, etc. ... or boxed objects
    local_item = {};
    local_item[node.sub || '.'] = item;
  }
  // else {proto.extend(item, local_item); }
  // proto.extend(item, context);
  proto.push(local_item, context);
  // so now it's item = {cool: 'stuff',
  //   __proto__: {original_context_var: 192, __proto__: {}.__proto__}}

  this.renderTokens(node.block, local_item, function() {
    proto.pop(local_item);
    callback();
  });
};


Renderer.prototype.renderTokens = function(tokens, context, callback) {
  var renderer = this, i = 0;
  (function next() {
    var node = tokens[i++];
    if (node === undefined) {
      // we're done! (with this scope, at least)
      return callback(undefined);
    }
    else if (node.t === 'raw') {
      renderer.outputWrite(node.val);
      next();
    }
    else if (node.t === 'partial') {
      // xxx: what about partials with context lookups (variables) for names?
      // xxx: or partials with yields?
      parsing.hitCache(node.val, function(err, tokens) {
        renderer.renderTokens(tokens, context, next);
      });
    }
    else if (node.t === 'yield') {
      (function bump() {
        var next_template = renderer.template_stack.shift(); // pop left
        if (next_template) {
          parsing.hitCache(next_template, function(err, tokens) {
            renderer.renderTokens(tokens, context, next);
          });
        }
        else {
          // no more templates on the template stack.
          if (renderer.asap) {
            renderer.once('bump', bump); // wait
          }
          else {
            // console.error('Cannot yield nothing. Wait, yes I can.');
            next();
          }
        }
      })();
    }
    else {
      (function bump() {
        var value = expressionEval(context, node.val);
        if (typeof(value) === 'function') {
          value = value();
        }

        if (value === undefined && renderer.asap) {
          // this.asap can be true if we want to wait,
          // and false if we merely want to ignore the missing contxt variables.
          renderer.once('bump', bump); // wait
        }
        else {
          if (value === undefined || value === null) value = '';

          if (node.t == 'section' || node.t == '!section') {
            if (!node.block) throw new Error("Cannot have empty block: " + node.block);
            if (Array.isArray(value) && !value.length) value = false; // hack for sake of Mu spec.
            var sub = node.t == '!section' ? !value : value;
            if (sub) {
              if (Array.isArray(value)) {
                var j = 0;
                (function next2() {
                  var top = value[j++];
                  if (top)
                    renderer.sectionRender(node, top, context, next2);
                  else
                    next();
                })();
              }
              else {
                renderer.sectionRender(node, value, context, next);
              }
            }
            else {
              next();
            }
          }
          else if (node.t == 'unescaped') {
            renderer.outputWrite(value.toString());
            next();
          }
          else { // (node.t == 'escaped')
            renderer.outputWrite(escapeHtml(value.toString()));
            next();
          }
        }
      })();
    }
    // } catch (err) {
    //   // renderer.outputError(err);
    //   console.error('Amulet error:', err.name, '-->', err.message);
    //   console.dir(err);
    //   console.trace();
    //   next();
    // }
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

// exports.StreamRenderer = StreamRenderer;
// exports.StringRenderer = StringRenderer;
