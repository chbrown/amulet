'use strict'; /*jslint es5: true, node: true, indent: 2 */
var helpers = require('../helpers');

function _parseSectionExpression(expression, type) {
  // returns a node, with {t: @type, val: 'something', sub: '_'}
  // or "thing" if you call it with expression = "something => thing"
  var node = {t: type, val: expression};
  var arrow_match = expression.match(/^(\S+)\s*[-=]>\s*(\S+)$/);
  if (arrow_match) {
    // by default, the iterated item or result of a section is stuck into the context._ variable.
    // by using the syntax {{#results -> result}}, we can require that it is accessible as context.result
    node.val = arrow_match[1];
    node.sub = arrow_match[2];
  }
  return node;
}

var StringParser = module.exports = function(options) {
  /** StringParser: mostly a closure around a single method (parse) to hold
  some options

  `opts`: Object
      `minify`: Boolean
          minify resulting html where possible (default: false)
      `open`: String
          string that designates the beginning of a expression (default: '{{')
      `close`: String
          string that designates the end of a expression (default: '}}')
  */
  this.options = options;
};

StringParser.prototype.parse = function(template_string) {
  /** fromString(...): parse a template string and compile into a template.

  `template_string`: String

  returns a compiled template, which is just an array.
  */
  var index = 0; // pointer to position in template
  var root = [];
  var stack = [root];
  var opts = helpers.extend({}, {minify: false, open: '{{', close: '}}'}, this.options);

  var push = function(node) {
    stack[stack.length - 1].push(node);
  };

  var scanRaw = function() {
    var next_mustache = template_string.indexOf(opts.open, index);
    if (next_mustache === -1) next_mustache = undefined;

    var raw = template_string.substring(index, next_mustache);
    if (opts.minify) {
      raw = raw.replace(/>\s+</g, '><').replace(/^\s+</, '<').replace(/>\s+$/, '>').replace(/^\s+$/, ' ');
    }
    index = next_mustache;
    push({t: 'raw', val: raw});

    if (next_mustache !== undefined) {
      scanMustache();
    }
  };

  var scanMustache = function() {
    // v-- index
    // {{whatever}}
    // index points to the beginning of the tag, so advance past that
    index += opts.open.length;

    var new_node;
    var all_signals = '&{><#^/!=';
    var signal = template_string[index];
    if (all_signals.indexOf(signal) > -1) {
      index++;
    }
    else {
      signal = '~';
    }
    // we've read the signal, now consume the mustache up to the end of the closing tag.
    var next_close_tag = template_string.indexOf(opts.close, index);
    var close_tag_length = opts.close.length; // silly hack for }}} closing tags

    // tokens can be
    // 1) strings
    // 2) functions (context -> string)
    // 3) objects
    //   3a) {t: 'block'}
    //   3b) {t: 'yield'}

    var expression = template_string.substring(index, next_close_tag).trim();
    if (signal == '~') {
      push({t: 'escaped', val: expression});
    }
    else if (signal == '&' || signal == '{') {
      if (signal == '{') close_tag_length++;
      push({t: 'unescaped', val: expression});
    }
    else if (signal == '>') {
      push({t: 'partial', val: expression});
    }
    else if (signal == '<') {
      push({t: 'yield', val: expression});
    }
    else if (signal == '#') {
      push(_parseSectionExpression(expression, 'section'));
      stack.push([]);
    }
    else if (signal == '^') {
      push(_parseSectionExpression(expression, '!section'));
      stack.push([]);
    }
    else if (signal == '/') {
      // var block = stack.pop();
      // var top = stack[stack.length - 1]; // get the new top of the stack (after the pop of the just-closed section = block)
      // var last = top[top.length - 1]; // get the last element in the top of the stack. This is a (!)section.
      // last.block = block; // add as block
      var parent = stack[stack.length - 2];
      parent[parent.length - 1].block = stack.pop();
    }
    else if (signal == '!') {
      // comment-tag
    }
    else if (signal == '=') {
      // e.g. "{{=<% %>=}}" but not "{{=<? ?>}}" (the closing = is required)
      var match = expression.match(/^\s*(\S+)\s+(\S+)\s*=$/);
      opts.open = match[1];
      opts.close = match[2];
    }
    else {
      console.error("The signal '" + signal + "' is not recognized mustache/amulet syntax.");
      console.error("   context -> " + template_string.substring(index - 10, index + 50));
    }
    index = next_close_tag + close_tag_length;
    // todo: syntax for "never wait even if mode is asap"
    //   (that is, act like asap=false for this variable, even if asap=true at the renderer level)

    // this.buffer_string = this.buffer_string.substring(index + close_tag_length);
    scanRaw();
  };

  scanRaw();
  // assert stack.length == 1 ?

  return root;
};
