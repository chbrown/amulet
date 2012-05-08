var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    Buffer = require('buffer').Buffer;

// Items in the cache are keyed by filepath, relative to SETTINGS.root or absolute,
//   based on whether the given filepath starts with a '/' or not.
var CACHE = {};
// Compiles a file. The result will be cached as the filename and can be
// rendered via that name.
var parseTemplate = exports.parseTemplate = function(name, template_string) {
  CACHE[name] = new Parser(template_string).tokens;
};
var SETTINGS = {}; // root: process.cwd()
// Hits the in-Node cache to see if the template exists. If it does, this'll
// call the callback pretty quickly, but if there's a cache miss, it'll have
// to read the file and then parse it (compileFilename).
exports.hitCache = function(name) {
  if (!CACHE[name]) {
    console.warn('Failed to get', name, 'from the cache... parsing.');
    var fullpath = name[0] === '/' ? name : path.join(SETTINGS.root, name);
    var file_contents = '';
    try {
      file_contents = fs.readFileSync(fullpath, 'utf8');
    }
    catch (e) {
      console.warn('Cannot find', name, '... using the empty string instead.');
      file_contents = ''; // xxx: is this correct behavior?
    }
    parseTemplate(name, file_contents);
  }
  return CACHE[name];
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
  // console.log("resetCache: ", path.join(root, relative));
  var files = fs.readdirSync(path.join(root, relative));
  // console.log("Cannot open directory: ", root);
  // console.log("  files: ", files);
  files.forEach(function(file) {
    var subrelative = path.join(relative, file),
        fullpath = path.join(root, subrelative),
        stats = fs.statSync(fullpath);
    if (stats.isDirectory())
      // recurse into sub-directory
      resetCache(root, subrelative);
    else if (path.extname(file) === '.mu') {
      var file_contents = fs.readFileSync(fullpath, 'utf8');
      parseTemplate(subrelative, file_contents);
    }
  });
}

var Parser = function(template_string, options) {
  this.buffer_string = template_string; //  = this.template_string
  this.state = 'raw'; // ('raw'|'mustache'|'eos')
  this.tokens = [];
  this.stack = [this.tokens];
  this.setTags('{{', '}}');
  this.options = options || {collapse: false};

  // basically infinite loop, until it ends by changing the stated state
  for (var i = 0; i < 10000; i++) {
    if (this.state === 'raw') {
      this.scanRaw();
    }
    else if (this.state === 'mustache') {
      this.scanMustache();
    }
    else {// if (this.state === 'eos')
      break;
    }
  }

  if (this.stack.length > 1) {
    // console.warn(util.inspect(this.tokens, false, null))
    console.warn("Some section(s) were not closed (outermost first):");
    this.stack.slice(1).reverse().forEach(function(substack, index) {
      console.warn(index, substack);
    });
    console.warn('TOKENS', this.tokens);
  }
  // console.log(this.tokens);
};

Parser.prototype = {
  setTags: function(open_tag, close_tag) {
    this.open_tag = open_tag;
    this.close_tag = close_tag;
  },
  stackTop: function() {
    return this.stack[this.stack.length - 1];
  },
  scanRaw: function () {
    var index = this.buffer_string.indexOf(this.open_tag);
    if (index === -1) {
      index = this.buffer_string.length;
      this.state = 'eos'; // stop
    }

    var raw = this.buffer_string.substring(0, index); //.replace(newlineRegExp, '\n'),
    if (raw !== '') {
      if (SETTINGS.minify) {
        raw = raw.replace(/>\s+</g, '><').replace(/^\s+</, '<').replace(/>\s+$/, '>').replace(/^\s+$/, ' ');
      }
      this.stackTop().push({t: 'raw', val: raw});
    }

    if (this.state !== 'eos') {
      this.buffer_string = this.buffer_string.substring(index + this.open_tag.length); // chop off the remainder
      this.state = 'mustache'; // send to scanMustache, but not directly, to avoid stack overflow
    }
    // else: this.buffer_string = ''; // if this is the end, don't worry about it
  },
  scanMustache: function () {
    var index = this.buffer_string.indexOf(this.close_tag);
    if (index === -1) {
      throw new Error('Encountered an unclosed tag. ' + this.buffer_string + ' should contain ' + this.close_tag + '.');
    }

    var raw = this.buffer_string.substring(0, index);
    var tag = raw.replace(/^\s+|\s+$/g, ''); // strip all edge whitespace
    var close_tag_length = this.close_tag.length; // silly hack for }}} closing tags

    // node.t is a string; e.g. 'escaped', 'unescaped', 'partial', 'section', etc.
    // node.val (optional, highly recommended) is a string, which must be an object in the context, possibly a function.
    // node.block (optional) is a list of nodes
    // node.arguments (optional) is a list of dicts, e.g.
    //   {t: "static"|"variable", val: "six"}, potentially empty/undefined.

    var new_node, top = this.stackTop();
    if (tag.match(/^\w/)) {
      new_node = {t: 'escaped', val: tag};
    } else if (tag[0] === '&') {
      new_node = {t: 'unescaped', val: tag.slice(1)};
    } else if (tag[0] === '{') {
      new_node = {t: 'unescaped', val: tag.slice(1)};
      close_tag_length++;
    } else if (tag[0] === '>') {
      new_node = {t: 'partial', val: tag.slice(1)};
    } else if (tag[0] === '<') {
      new_node = {t: 'yield'};
    } else if (tag[0] === '=') {
      // e.g. "{{=<% %>=}}" but not "{{=<? ?>}}"
      var parts = tag.slice(1, -1).split(' ');
      this.setTags(parts[0], parts[1]);
    } else if (tag[0] === '#') {
      new_node = {t: 'section', val: tag.slice(1)};
      this.stack.push([]);
    } else if (tag[0] === '^') {
      new_node = {t: 'inverted_section', val: tag.slice(1)};
      this.stack.push([]);
    } else if (tag[0] === '/') {
      var block = this.stack.pop();
      top = this.stackTop();
      if (top === undefined) {
        console.error('Stack exhausted (too many closing tags)');
        console.dir(this.tokens);
        console.log("REMAINDER:", this.buffer_string);
      }
      var top_last_node = top[top.length - 1]; // get the declaration of the (inverted_)section
      top_last_node.block = block; // add as block
    } else if (tag[0] === '!') {
      // nothing
    } else {
      console.error("The tag '" + tag + "' is not recognized mustache/amulet syntax. ");
      console.log(util.inspect(this.tokens, true, null));
    }

    if (new_node !== undefined) {
      if (new_node.val) {

        // ->
        if (new_node.t === 'section' || new_node.t === 'inverted_section') {
          var section_match = new_node.val.match(/\s*->\s*/);
          if (section_match) {
            // by default, the iterated item or result of a section is stuck into the context._ variable.
            // by using the syntax {{#results -> result}}, we can require that it is accessible as context.result
            new_node.subsection = new_node.val.slice(section_match.index + section_match[0].length);
            // console.log("Setting subsection to", new_node.subsection);
            new_node.val = new_node.val.slice(0, section_match.index);
          }
        }

        // |
        var pipe_match = new_node.val.match(/\s*\|\s*/);
        if (pipe_match) {
          // xxx: support chaining!
          // xxx: support pulling out of context if eval throws an error or returns undefined
          new_node.filter = eval(new_node.val.slice(pipe_match.index + pipe_match[0].length));
          new_node.val = new_node.val.slice(0, pipe_match.index);
        }

        // open parens indicates function application,
        //   the entire following conditional is for functional application.
        var open_parens_index = new_node.val.indexOf('(');
        if (open_parens_index > -1) {
          // close_parens_index should be append_to_top.length - 1
          var close_parens_index = new_node.val.lastIndexOf(')');

          // String.substring takes two indices (not a length)
          var argument_part = new_node.val.substring(open_parens_index + 1, close_parens_index);
          // trim whitespace/quotes since arguments can only be strings or ints anyway. At least, for now.
          // (xxx: let them embed commas in strings)
          var argument_array = argument_part.split(',').map(function(s) {
            var trimmed_val = s.replace(/^\s+|\s+$/g, '');
            var type = 'variable';
            if (trimmed_val.match(/^['"].*['"]$/)) {
              type = 'static';
              trimmed_val = trimmed_val.slice(1, -1);
            }
            else if (trimmed_val.match(/^-?\d+\.?\d*$/)) {
              // it's a number! but it's okay for it to stay a string, here.
              type = 'static';
            }
            return {t: type, val: trimmed_val};
          });

          new_node.val = new_node.val.slice(0, open_parens_index);
          new_node['arguments'] = argument_array;
        }

      }
      top.push(new_node);
    }
    // todo: syntax for "never wait even if mode is asap"
    //   (that is, act like asap=false for this variable, even if asap=true at the renderer level)

    this.buffer_string = this.buffer_string.substring(index + close_tag_length);
    this.state = 'raw'; // send to scanMustache
  },
  postProcess: function() {
    // operates on this.tokens in place.
    function walk(tokens) {
      for (var k = 0; k < tokens.length; k++) {

      }
    }
    walk(this.tokens);
    // return this.stack[this.stack.length - 1];
  }
};
