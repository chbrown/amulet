var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    Buffer = require('buffer').Buffer;

// Items in the cache are keyed by filepath, relative to SETTINGS.root or absolute,
//   based on whether the given filepath starts with a '/' or not.
var CACHE = {};
var SETTINGS = {}; // root: process.cwd()
// Hits the in-Node cache to see if the template exists. If it does, this'll
// call the callback pretty quickly, but if there's a cache miss, it'll have
// to read the file and then parse it (compileFilename).
var emptyCache = exports.emptyCache = function() {
  CACHE = {};
};
var hitCache = exports.hitCache = function(name, callback) {
  if (CACHE[name] === undefined) {
    // console.warn('Failed to get', name, 'from the cache... parsing.');
    var fullpath = name[0] === '/' ? name : path.join(SETTINGS.root, name);
    var file_contents = '';
    fs.readFile(fullpath, 'utf8', function(err, file_contents) {
      if (err) {
        // console.error('Cannot find', name, '... using the empty string instead.');
        file_contents = ''; // xxx: is this correct behavior?
      }
      var template = parseTemplate(name, file_contents);
      callback(err, template);
    });
  }
  else {
    // enforce this to be truly async
    process.nextTick(function() {
      callback(null, CACHE[name]);
    });
  }
};
function set(key, val) {
  if (key === 'root') {
    // This is synchronous
    SETTINGS.root = val;
    process.nextTick(function() {
      resetCache(val, '.');
    });
  }
  else {
    SETTINGS[key] = val;
  }
}
exports.set = function(obj, val) {
  if (val) {
    set(obj, val);
  }
  else {
    for (var key in obj) {
      set(key, obj[key]);
    }
  }
};
function resetCache(root, relative, callback) {
  // this RECURSES through the paths below ROOT, asynchronously,
  //   and parses them as templates, if they end with .mu
  var files = fs.readdirSync(path.join(root, relative));
  files.forEach(function(file) {
    var subrelative = path.join(relative, file),
        fullpath = path.join(root, subrelative),
        stats = fs.statSync(fullpath);
    if (stats.isDirectory())
      // recurse into sub-directory
      resetCache(root, subrelative);
    else if (file.match(/\.mu$/)) {
      var file_contents = fs.readFileSync(fullpath, 'utf8');
      parseTemplate(subrelative, file_contents);
    }
  });
}

function escapeRegExp(string){
  // from MDN
  return string.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1");
}

function parseSectionExpression(expression, type) {
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

// Compiles a file. The result will be cached as the filename and can be rendered via that name.
var parseTemplate = exports.parseTemplate = function(template_name, template_string) {
  var index = 0; // pointer to position in template
  // var state = 'raw'; // ('raw'|'mustache'|'eos')
  var open_tag = '{{';
  var close_tag = '}}';

  var root = [];
  var stack = [root];

  var push = function(node) {
    stack[stack.length - 1].push(node);
  };

  var scanRaw = function() {
    var next_mustache = template_string.indexOf(open_tag, index);
    if (next_mustache === -1) next_mustache = undefined;

    var raw = template_string.substring(index, next_mustache);
    if (SETTINGS.minify) {
      raw = raw.replace(/>\s+</g, '><').replace(/^\s+</, '<').replace(/>\s+$/, '>').replace(/^\s+$/, ' ');
    }
    index = next_mustache;
    push({t: 'raw', val: raw});

    if (next_mustache !== undefined) {
      scanMustache();
    }
  };

  var scanMustache = function () {
    // v-- index
    // {{whatever}}
    // index points to the beginning of the tag, so advance past that
    index += open_tag.length;

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
    var next_close_tag = template_string.indexOf(close_tag, index);
    var close_tag_length = close_tag.length; // silly hack for }}} closing tags

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
      push(parseSectionExpression(expression, 'section'));
      stack.push([]);
    }
    else if (signal == '^') {
      push(parseSectionExpression(expression, '!section'));
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
      open_tag = match[1];
      close_tag = match[2];
    }
    else {
      console.error("The signal '" + signal + "' is not recognized mustache/amulet syntax.");
      console.error("   context -> " + template_string.substring(index - 10, index + 50));
    }
    index = next_close_tag + close_tag_length;
    // todo: syntax for "never wait even if mode is asap"
    //   (that is, act like asap=false for this variable, even if asap=true at the renderer level)

    // this.buffer_string = this.buffer_string.substring(index + close_tag_length);
    // this.state = 'raw'; // send to
    scanRaw();
  };

  scanRaw();
  // assert stack.length == 1 ?

  CACHE[template_name] = root;
  return root;
};
