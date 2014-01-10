'use strict'; /*jslint es5: true, node: true, indent: 2 */
var util = require('util');
var stream = require('stream');

var helpers = require('./helpers');

var Renderer = module.exports = function(template_names, template_cache, context, globals, asap) {
  stream.Readable.call(this);
  this.template_names = template_names;
  this.template_cache = template_cache;
  this.context = context === undefined ? {} : context;
  this.globals = globals === undefined ? {} : globals;
  this.asap = asap === undefined ? false : asap;
};
util.inherits(Renderer, stream.Readable);

Renderer.prototype._read = function(size) { };

Renderer.prototype.start = function() {
  var self = this;
  this.renderTokens([{t: 'yield'}], this.context, function(err) {
    if (err) {
      self.emit('error', err);
    }
    self.push(null);
  });
  return this;
};

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
  var loop = function(index) {
    var node = tokens[index];
    var next = function() {
      return loop(index + 1);
    };
    if (node === undefined) {
      // we're done! (with this scope, at least)
      return callback(undefined);
    }
    else if (node.t === 'raw') {
      renderer.push(node.val);
      next();
    }
    else if (node.t === 'partial') {
      // xxx: what about partials with context lookups (variables) for names?
      // xxx: or partials with yields?
      renderer.template_cache.get(node.val, function(err, subtokens) {
        // mustache spec says ignore missing partials
        if (err && err.code == 'ENOENT') return next();
        else if (err) return callback(err);
        renderer.renderTokens(subtokens, context, function(err) {
          if (err) return callback(err);
          next();
        });
      });
    }
    else if (node.t === 'yield') {
      var next_template_name = renderer.template_names.shift(); // shift just pops from the left
      if (next_template_name) {
        renderer.template_cache.get(next_template_name, function(err, subtokens) {
          if (err) return callback(err);
          renderer.renderTokens(subtokens, context, function(err) {
            if (err) return callback(err);
            next();
          });
        });
      }
      // no more template names on the template stack.
      else if (renderer.asap) {
        // wait
        renderer.once('bump', function() {
          loop(index);
        });
      }
      else {
        // forge ahead regardless of the missing template
        next();
      }
    }
    else {
      var value = renderer.evaluateExpression(context, node.val);
      if (value === undefined && renderer.asap) {
        // this.asap == true if we want to wait,
        // and false if we merely want to ignore the missing contxt variables.
        renderer.once('bump', function() {
          loop(index);
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
              var block_context = {__depth: 0};
              if (node.sub) {
                // if the template specifies a "sub" name (with -> or =>), use that to embed each entry
                block_context[node.sub] = item;
              }
              else if (item === Object(item)) {
                // if the item is a plain object, it overlays the context, not embedded
                block_context = item;
              }
              else {
                // otherwise, if the children are not Objects, and no 'sub' name is specified,
                // use the special '.' key as the embedding name.
                block_context['.'] = item;
              }
              helpers.protoPush(block_context, context); // make item.__proto__ == context
              renderer.renderTokens(node.block, block_context, function(err) {
                if (err) return callback(err);
                helpers.protoPop(block_context); // remove item's __proto__, now that we're done with it.
                callback();
              });
            };

            if (Array.isArray(value)) {
              helpers.eachSeries(value, renderBlock, next);
            }
            else {
              renderBlock(value, next);
            }
          }
          else {
            next();
          }
        }
        else if (node.t == 'unescaped') {
          renderer.push(value.toString());
          next();
        }
        else { // (node.t == 'escaped')
          renderer.push(helpers.escapeHtmlString(value.toString()));
          next();
        }
      }
    }
  };
  loop(0);
};

Renderer.prototype.evaluateExpression = function(context, expression) {
  // expression can be a function call, a boolean, or a simple string.
  var globals = this.globals;
  var m;
  // a << b returns true if a contains b (b in a), a >> b returns true if b contains a (a in b)
  //   i.e., the syntax is (haystack << needle), and helpers.contains is function(needle, haystack)
  var ops = ['==', '===', '!=', '!==', '<', '<=', '>', '>=', '>>', '<<'];
  var op_regex = new RegExp('^(\\S+)\\s*(' + ops.join('|') + ')\\s*(\\S+)$');
  if ((m = expression.match(op_regex))) {
    var left = helpers.flexibleEval(context, m[1], globals);
    var op = m[2];
    var right = helpers.flexibleEval(context, m[3], globals);


    if (op === '===') return left === right;
    else if (op === '!=') return left != right;
    else if (op === '!==') return left !== right;
    else if (op === '<') return left < right;
    else if (op === '<=') return left <= right;
    else if (op === '>') return left > right;
    else if (op === '>=') return left >= right;
    else if (op === '>>') return helpers.contains(left, right);
    else if (op === '<<') return helpers.contains(right, left);
    else /*if (op === '==')*/ return left == right;
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
    var func_evaluations = helpers.dottedEval(context, m[1], globals);
    var func = func_evaluations[0];
    var binding = func_evaluations[1];

    var args = m[2].split(',').map(function(expression) {
      return helpers.flexibleEval(context, expression, globals);
    });

    if (func === undefined) {
      var func_err = new Error('Undefined function in function application expression, "' + expression + '", ' +
        'with evaluations: [' + func_evaluations.join(', ') + '] and match: ' + m.toString());
      this.emit('error', func_err);
      return null;
    }
    else {
      return func.apply(binding, args);
    }
  }
  else {
    var evaluations = helpers.dottedEval(context, expression, globals);
    var tip = evaluations[0];
    var second = evaluations[1];
    // handle implicit functions
    if (tip && tip.call) {
      // call without arguments, but with binding
      return tip.call(second);
    }
    return tip;
  }
};
