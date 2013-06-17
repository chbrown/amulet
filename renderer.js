'use strict'; /*jslint node: true, es5: true, indent: 2 */
var util = require('util');
var stream = require('stream');
var proto = require('./proto');

var GLOBALS = {
  'JSON': JSON,
  'Number': Number,
  'Object': Object
};

function series(array, each, callback) {
  // `each` signature: function(item, callback)
  // `callback` signature: function()
  var i = 0;
  var next = function() {
    if (i < array.length) {
      var item = array[i++];
      return each(item, next);
    }
    else {
      return callback();
    }
  };
  return next();
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, function(s) {
    switch (s) {
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '&':
      return '&amp;';
    case '"':
      return '&quot;';
    default:
      return s;
    }
  });
}

function dottedEval(context, expression) {
  // handles strings that occur in context or dotted paths that traverse a context object
  var evaluations;
  if (expression == '.') {
    // for those embedded sections (silly Mustache spec, should be _)
    evaluations = [context['.'], context];
  }
  else {
    var parts = expression.split('.');
    var length = parts.length;
    evaluations = new Array(length + 1);
    evaluations[length] = context;
    for (var i = 0; i < length; i++) {
      var part = parts[i];
      var subcontext = evaluations[length - i];
      var value = (subcontext !== undefined && subcontext !== null) ? subcontext[part] : null;
      if (value === null || value === undefined) {
        if (GLOBALS[part] !== undefined) {
          value = GLOBALS[part];
        }
      }
      evaluations[length - i - 1] = value;
    }
  }
  return evaluations;
}

function expressionEval(context, expression) {
  // expression can be a function call, a boolean, or a simple string.
  var m, evaluations;
  if ((m = expression.match(/^(\S+)\s*([!=<>]+)\s*(\S+)$/))) {
    // booleans: ==, ===, !=, !==, <, <=, >, >=
    var left = dottedEval(context, m[1])[0];
    var op = m[2];
    var right = dottedEval(context, m[3])[0];
    if (op === '==') return left == right;
    else if (op === '===') return left === right;
    else if (op === '!=') return left != right;
    else if (op === '!==') return left !== right;
    else if (op === '<') return left < right;
    else if (op === '<=') return left <= right;
    else if (op === '>') return left > right;
    else if (op === '>=') return left >= right;
    else throw new Error('Unrecognized operator: ' + op);
  }
  else if ((m = expression.match(/^(\S+)\(([^\)]*)\)$/))) {
    // functions.
    // open parens indicates function application,
    //   the entire following conditional is for functional application.
    // close_parens_index should be append_to_top.length - 1

    // String.substring takes two indices (not a length)
    // var argument_part = new_node.val.substring(open_parens_index + 1, close_parens_index);
    // trim whitespace/quotes since arguments can only be strings or ints anyway. At least, for now.
    // (todo: let them embed commas in strings)
    // if m[1] == 'receipt.total.substr'
    //    `func` should be the substr, and
    //    `binding` should be receipt.total
    evaluations = dottedEval(context, m[1]);
    var func = evaluations[0];
    var binding = evaluations[1];

    var args = m[2].split(',').map(function(raw) {
      var val = raw.replace(/^\s+|\s+$/g, ''); // trim
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
        val = dottedEval(context, val)[0];
      }
      return val;
    });

    return func.apply(binding, args);
  }
  else {
    evaluations = dottedEval(context, expression);
    var tip = evaluations[0];
    var second = evaluations[1];
    // handle implicit functions
    if (tip && tip.call) {
      // call without arguments, but with binding
      return tip.call(second);
    }
    return tip;
  }
}

var Renderer = module.exports = function(templates, context, asap, lookup) {
  stream.Readable.call(this);
  this.templates = templates;
  this.context = context === undefined ? {} : context;
  this.asap = asap === undefined ? false : asap; // asap defaults to false.
  this.lookup = lookup;

  var self = this;
  self.renderTokens([{t: 'yield'}], this.context, function(err) {
    self.push(null);
  });
};
util.inherits(Renderer, stream.Readable);
Renderer.prototype._read = function(size) { };
Renderer.prototype.extendContext = function(obj, val) { // chainable
  // e.g.:
  // - extendContext('friends', 98);
  // - extendContext({friends: 98, created: 'now});
  if (val === undefined) {
    for (var attr in obj) {
      this.context[attr] = obj[attr];
    }
  }
  else {
    this.context[obj] = val;
  }
  this.emit('bump');
  return this;
};
Renderer.prototype.force = function() { // chainable
  // use force to quit waiting for new context variables,
  // and simply leave gaps for missing context variables
  this.asap = false;
  this.emit('bump');
  return this;
};
Renderer.prototype.renderTokens = function(tokens, context, callback) {
  var renderer = this;
  var next = function(index) {
    var node = tokens[index];
    if (node === undefined) {
      // we're done! (with this scope, at least)
      return callback(undefined);
    }
    else if (node.t === 'raw') {
      renderer.push(node.val);
      next(index + 1);
    }
    else if (node.t === 'partial') {
      // xxx: what about partials with context lookups (variables) for names?
      // xxx: or partials with yields?
      renderer.lookup.get(node.val, function(err, subtokens) {
        renderer.renderTokens(subtokens, context, function() {
          next(index + 1);
        });
      });
    }
    else if (node.t === 'yield') {
      var next_template = renderer.templates.shift(); // pop left
      if (next_template) {
        renderer.lookup.get(next_template, function(err, subtokens) {
          renderer.renderTokens(subtokens, context, function() {
            next(index + 1);
          });
        });
      }
      // no more templates on the template stack.
      else if (renderer.asap) {
        // wait
        renderer.once('bump', function() {
          next(index);
        });
      }
      else {
        // forge ahead regardless of the missing template
        next(index + 1);
      }
    }
    else {
      var value = expressionEval(context, node.val);
      if (value === undefined && renderer.asap) {
        // this.asap == true if we want to wait,
        // and false if we merely want to ignore the missing contxt variables.
        renderer.once('bump', function() {
          next(index);
        });
      }
      else {
        if (value === undefined || value === null) value = '';

        if (node.t == 'section' || node.t == '!section') {
          // we show sections for truthy values, and !sections for falsey values
          if (Array.isArray(value) && value.length === 0) value = false; // [] is falsey
          var active = node.t == 'section' ? value : !value;
          if (active) {
            var renderBlock = function(item, callback) {
              var block_context = item === Object(item) ? item : {'.': item, __depth: 0};
              proto.push(block_context, context); // make item.__proto__ == context
              renderer.renderTokens(node.block, block_context, function() {
                proto.pop(block_context); // remove item's __proto__, now that we're done with it.
                callback();
              });
            };

            if (Array.isArray(value)) {
              series(value, renderBlock, function() { next(index + 1); });
            }
            else {
              renderBlock(value, function() { next(index + 1); });
            }
          }
          else {
            next(index + 1);
          }
        }
        else if (node.t == 'unescaped') {
          renderer.push(value.toString());
          next(index + 1);
        }
        else { // (node.t == 'escaped')
          renderer.push(escapeHtml(value.toString()));
          next(index + 1);
        }
      }
    }
  };
  next(0);
};
