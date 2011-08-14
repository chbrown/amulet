var Buffer = require('buffer').Buffer;
var fs = require('fs');
var path = require('path');
var util = require('util');

var ROOT = process.cwd();
// Items in the cache are keyed by filepath, relative to ROOT or absolute, 
//   based on whether the given filepath starts with a '/' or not.
var CACHE = {};
// Compiles a file. The result will be cached as the filename and can be
// rendered via that name.
var parseTemplate = exports.parseTemplate = function(name, template_string) {
  CACHE[name] = new Parser(template_string).tokens;
};
// Hits the in-Node cache to see if the template exists. If it does, this'll 
// call the callback pretty quickly, but if there's a cache miss, it'll have
// to read the file and then parse it (compileFilename).
exports.hitCache = function(name) {
  if (!CACHE[name]) {
    console.warn('Failed to get', name, 'from the cache... parsing.');
    var fullpath = name[0] === '/' ? name : path.join(ROOT, name);
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
exports.root = function(directory, resetCache) {
  // This is synchronous
  if (directory === undefined) {
    // GETTER
    return ROOT;
  }
  else {
    // SETTER
    ROOT = path.join(directory, '.');
    if (resetCache === undefined || resetCache === true) {
      resetCache('.'); // and yes, even this is synchronous
    }
  }
};
function resetCache(local) {
  // this RECURSES through the paths below ROOT, asynchronously, and parses them as templates, if they end with .mu
  fs.readdir(path.join(ROOT, local), function(err, files) {
    if (err) {
      throw err;
    }
    files.forEach(function(file) {
      var sublocal = path.join(local, file);
      var fullpath = path.join(ROOT, sublocal);
      fs.stat(fullpath, function(err, stats) {
        if (err) {
          throw err;
        }
        if (stats.isFile() && path.extname(sublocal) === '.mu') {
          fs.readFile(fullpath, 'utf8', function(err, file_contents) {
            if (err) {
              throw err;
            }
            parseTemplate(sublocal, file_contents);
          });
        }
        else if (stats.isDirectory()) {
          // recurse into sub-directory
          return resetCache(sublocal);
        }
      });
    });
  });
}
// var escapeRegex = function(text) {
//   // thank you Simon Willison
//   if (!arguments.callee.sRE) {
//     var specials = ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\']
//     arguments.callee.sRE = new RegExp('(\\' + specials.join('|\\') + ')', 'g')
//   }
//   return text.replace(arguments.callee.sRE, '\\$1')
// }

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
    console.warn("Some section(s) were not closed:", 
      this.stack.slice(1).map(function(item) { return '[' + item[0] + ', ' + item[1] + ']'; }).join('\n '));
  }
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
    var eos = false;
    if (index === -1) {
      index = this.buffer_string.length;
      eos = true;
    }

    var raw = this.buffer_string.substring(0, index); //.replace(newlineRegExp, '\n'),
    if (raw !== '') {
      this.stackTop().push(['raw', raw]);
    }

    
    // var buffer  = new Buffer(Buffer.byteLength(content))

      // var top_last = top[top.length - 1];
      // raw = raw.replace(/\n+/g, '\n');
      // if (top_last && top_last[0] === 'raw') { // this only happens when delimiters are changed (rare!)
      //   top_last[1] += raw;
      // }
      // buffer.write(content, 'utf8', 0)
   
    // var line = this.currentLine + content

    // this.currentLine = line.substring(line.lastIndexOf('\n') + 1, line.length)
    if (eos) {
      this.state = 'eos'; // stop
      this.buffer_string = '';
    }
    else {
      this.state = 'mustache'; // send to scanMustache, but not directly, to avoid stack overflow
      this.buffer_string = this.buffer_string.substring(index + this.open_tag.length); // chop off the remainder
    }
  },
  scanMustache: function () {
    var index = this.buffer_string.indexOf(this.close_tag);
    if (index === -1) {
      throw new Error('Encountered an unclosed tag. ' + this.buffer_string + ' should contain ' + this.close_tag + '.');
    }
    
    var raw = this.buffer_string.substring(0, index);
    var tag = raw.replace(/^\s+|\s+$/g, ''); // strip all edge whitespace
    var close_tag_length = this.close_tag.length; // silly hack for }}} closing tags

    // var match = tag.match(/(\W*)(.+)/);
    // var symbol = match[1];
    // var variable = match[2];
    
    // 1-long: (command)
    //   yield
    // 2-long: (command, variable)
    //   everything else, except for sections
    // 3-long: (command, variable, block)
    //   sections and inverted_sections

    var top = this.stackTop(), top_last;
    if (tag.match(/^\w/)) {
      top.push(['escaped', tag]);
    } else if (tag[0] === '&') {
      top.push(['unescaped', tag.slice(1)]);
    } else if (tag[0] === '{') {
      top.push(['unescaped', tag.slice(1)]);
      close_tag_length++;
    } else if (tag[0] === '>') {
      top.push(['partial', tag.slice(1)]);
    } else if (tag[0] === '<') {
      top.push(['yield']);
    } else if (tag[0] === '=') {
      // e.g. "{{=<% %>=}}" but not "{{=<? ?>}}"
      var parts = tag.slice(1, -1).split(' ');
      this.setTags(parts[0], parts[1]);
    } else if (tag[0] === '#' || tag[0] === '^') {
      var name = tag[0] === '#' ? 'section' : 'inverted_section';
      // here we shrink the line containing the section {{#variable}}, if possible.
      // so, check that this tag occurs on it's own line. This is almost ridiculous.
      // XXX: ACTUALLY, NVM, do this in a post-processing walk-step. Be faster that way.
      // top_last = top[top.length - 1];
      // try {
        // if (top_last !== undefined && top_last[0] === 'raw') {
        //   var remainder_newline_index = remainder.search(/^\s*\n/);
        //   if (remainder_newline_index !== -1) {
        //     var previous = top_last[1];
        //     var previous_newline = previous.search(/\n\s*$/);
        //     if (previous_newline !== -1) {
        //       console.log('== Previous:');
        //       console.log('<< "' + previous.replace(/\n/g, '\\n') + '"');
        //       previous = previous.slice(0, previous_newline);
        //       top_last[1] = previous !== '' ? previous + '\n' : '';
        //       console.log('>> "' + top_last[1].replace(/\n/g, '\\n') + '"');
        //       console.log('Remainder[:100]:\n  "' + remainder.slice(0, 100).replace(/\n/g, '\\n') + '"\n---------==========>\n  "' + remainder.substring(remainder_newline_index + 1).replace(/\n/g, '\\n') + '"');
        //       remainder = remainder.substring(remainder_newline_index + 1);
        //     }
        //   }
        // }
      // } 
      // catch(e) {
      //   console.log('Error!!!');
      //   console.dir(this.stack);
      //   throw e;
      // }
      top.push([name, tag.slice(1)]);
      this.stack.push([]);
    } else if (tag[0] === '/') {
      var popped_top = this.stack.pop();
      top = this.stackTop();
      top_last = top[top.length - 1]; // get the declaration of the (inverted_)section
      top_last[2] = popped_top; // add as block
      // Screw it. Close whatever is open and on top of the stack.
      //var original_command = next_last[0];
      //var original_variable = next_last[1];
      //if (original_command !== 'section' && original_command !== 'inverted_section') {
      //  throw new Error('Closing unopened section with ' + tag.slice(1) + '; ' + original_command + ' should be a section.');
      //}
      //else if (original_variable !== tag.slice(1)) {
      //  throw new Error('Unmatched closing section; ' + tag.slice(1) + ' should be ' + original_variable);
      //}
    } else if (tag[0] === '!') {
      // nothing
    } else {
      console.error("The tag '" + tag + "' is not recognized mustache/amulet syntax.");
      // if (variable) {
      //   top.push(['escaped', variable])
      // }
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
  },
};
