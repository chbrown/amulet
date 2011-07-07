var Buffer = require('buffer').Buffer
var fs = require('fs')
var path = require('path')
var util = require('util')

var ROOT = process.cwd()
// Items in the cache are keyed by filepath, relative to ROOT or absolute, 
//   based on whether the given filepath starts with a '/' or not.
var CACHE = {}
// Compiles a file. The result will be cached as the filename and can be
// rendered via that name.
var parseTemplate = exports.parseTemplate = function(name, template_string) {
  CACHE[name] = new Parser(template_string).tokens
  // console.log('\n\n*******************************************************************')
  // console.log('template =================> ' + name)
  // console.log(util.inspect(CACHE[name], false, null))
}
// Hits the in-Node cache to see if the template exists. If it does, this'll 
// call the callback pretty quickly, but if there's a cache miss, it'll have
// to read the file and then parse it (compileFilename).
exports.hitCache = function(name) {
  if (!CACHE[name]) {
    console.warn('Failed to get', name, 'from the cache... parsing.')
    var fullpath = name[0] === '/' ? name : path.join(ROOT, name)
    try {
      var file_contents = fs.readFileSync(fullpath, 'utf8')
    }
    catch (e) {
      var file_contents = ''; // xxx: is this correct behavior?
    }
    parseTemplate(name, file_contents)
  }
  return CACHE[name]
}
exports.root = function(directory) {
  // This is synchronous
  if (directory === undefined) {
    // GETTER
    return ROOT
  }
  else {
    // SETTER
    ROOT = path.join(directory, '.')
    resetCache('.')
  }
}
function resetCache(local) {
  // this RECURSES through the paths below ROOT, asynchronously, and parses them as templates, if they end with .mu
  fs.readdir(path.join(ROOT, local), function(err, files) {
    if (err) throw err
    files.forEach(function(file) {
      var sublocal = path.join(local, file)
      var fullpath = path.join(ROOT, sublocal)
      fs.stat(fullpath, function(err, stats) {
        if (err) throw err
        if (stats.isFile() && path.extname(sublocal) === '.mu') {
          fs.readFile(fullpath, 'utf8', function(err, file_contents) {
            if (err) throw err
            // console.log('Auto-parsing and caching', sublocal)
            parseTemplate(sublocal, file_contents)
          })
        }
        else if (stats.isDirectory()) {
          // recurse into sub-directory
          return resetCache(sublocal)
        }
      })
    })
  })
}
// var escapeRegex = function(text) {
//   // thank you Simon Willison
//   if (!arguments.callee.sRE) {
//     var specials = ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\']
//     arguments.callee.sRE = new RegExp('(\\' + specials.join('|\\') + ')', 'g')
//   }
//   return text.replace(arguments.callee.sRE, '\\$1')
// }

// var newline = '__MU_NEWLINE__'
// var newlineRegExp = new RegExp(newline, 'g')





var Parser = function(template_string, options) {
  this.buffer_string = template_string //  = this.template_string
  this.state = 'raw' // ('raw'|'mustache'|'eos')
  this.tokens = []
  this.stack = [this.tokens]
  this.setTags('{{', '}}')
  this.options = options || {collapse: false}

  // basically infinite loop, until it ends by changing the stated state
  for (var i = 0; i < 10000; i++) {
    if (this.state === 'raw')
      this.scanRaw()
    else if (this.state === 'mustache')
      this.scanMustache()
    else // if (this.state === 'eos')
      break
  }
  
  if (this.stack.length > 1) {
    // console.warn(util.inspect(this.tokens, false, null))
    console.warn("Some section(s) were not closed:", 
      this.stack.slice(1).map(function(item) { return '[' + item[0] + ', ' + item[1] + ']' }).join('\n '))
  }
}

Parser.prototype = {
  setTags: function(open_tag, close_tag) {
    this.open_tag = open_tag
    this.close_tag = close_tag
    // this.escaped_close_tag = escapeRegex(this.close_tag)
  },
  scanRaw: function () {
    var index = this.buffer_string.indexOf(this.open_tag)
    var eos = false
    if (index === -1) {
      index = this.buffer_string.length
      eos = true
    }

    
    var raw = this.buffer_string.substring(0, index) //.replace(newlineRegExp, '\n'),
    // var buffer  = new Buffer(Buffer.byteLength(content))
    if (raw !== '') {
      var top = this.stack[this.stack.length - 1]
      var top_last = top[top.length - 1]
      if (top_last && top_last[0] === 'raw')
        top_last[1] += raw
      else
        top.push(['raw', raw])
      // buffer.write(content, 'utf8', 0)
    }
   
    // var line = this.currentLine + content

    // this.currentLine = line.substring(line.lastIndexOf('\n') + 1, line.length)
    // console.log('line:', this.buffer.lastIndexOf(newline) + newline.length, index, '>', this.currentLine, '/end')
    if (eos) {
      this.state = 'eos' // stop
      this.buffer_string = ''
    }
    else {
      this.state = 'mustache' // send to scanMustache, but not directly, to avoid stack overflow
      this.buffer_string = this.buffer_string.substring(index + this.open_tag.length) // chop off the remainder
    }
  },
  scanMustache: function () {
    var index = this.buffer_string.indexOf(this.close_tag)
    if (index === -1)
      throw new Error('Encountered an unclosed tag. ' + this.buffer_string + ' should contain ' + this.close_tag + '.')

    var raw = this.buffer_string.substring(0, index)
    var stripped = raw.replace(/\s/g, '') // strip all whitespace
    var match = stripped.match(/(\W*)(.+)/)
    var symbol = match[1]
    var variable = match[2]
    
    // 1-long: (command)
    //   yield
    // 2-long: (command, variable)
    //   everything else, except for sections
    // 3-long: (command, variable, block)
    //   sections and inverted_sections
    var top = this.stack[this.stack.length - 1]
    if (symbol === '') {
      top.push(['escaped', variable])
    } else if (symbol === '_') {
      top.push(['escaped', '_'])
    } else if (symbol === '&') {
      top.push(['unescaped', variable])
    } else if (symbol === '{') {
      if (variable[variable.length - 1] === '}')
        variable = variable.slice(0, -1)
      top.push(['unescaped', variable])
    } else if (symbol === '>') {
      top.push(['partial', variable])
    } else if (symbol === '<') {
      top.push(['yield'])
    } else if (symbol === '!' || symbol[0] === '!') {
      // nothing
    } else if (symbol === '=') {
      // e.g. "{{=<% %>=}}" or "{{=<?= ?>}}"
      if (variable[variable.length - 1] === '=')
        variable = variable.slice(0, -1)
      var parts = variable.split(' ')
      this.setTags(parts[0], parts[1])
    } else if (symbol === '#') {
      top.push(['section', variable])
      this.stack.push([])
    } else if (symbol === '^') {
      top.push(['inverted_section', variable])
      this.stack.push([])
    } else if (symbol === '/') {
      top = this.stack.pop() // redundant
      var next = this.stack[this.stack.length - 1]
      var next_last = next[next.length - 1] // get the declaration of the (inverted_)section
      var original_command = next_last[0]
      var original_variable = next_last[1]
      if (original_command !== 'section' && original_command !== 'inverted_section') {
        console.dir(this.tokens)
        throw new Error('Closing unopened section with ' + variable + '; ' + original_command + ' should be a section.')
      }
      else if (original_variable !== variable)
        throw new Error('Unmatched closing section; ' + variable + ' should be ' + original_variable)
      next_last[2] = top // add as block
    } else {
      console.log("The symbol,", symbol, "is not recognized. Are you sure it's not a typo? Near:", variable)
      // if (variable) {
      //   top.push(['escaped', variable])
      // }
    }
    // todo: syntax for "never wait even if mode is asap"
    //   (that is, act like asap=false for this variable, even if asap=true at the renderer level)
    
    this.buffer_string = this.buffer_string.substring(index + this.close_tag.length) // chop off the remainder
    this.state = 'raw' // send to scanMustache
  }
}
