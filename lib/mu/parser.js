var sys    = require('sys'),
    util   = require('util'),
    Buffer = require('buffer').Buffer

var escapeRegex = function(text) {
  // thank you Simon Willison
  if (!arguments.callee.sRE) {
    var specials = ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\']
    arguments.callee.sRE = new RegExp('(\\' + specials.join('|\\') + ')', 'g')
  }
  return text.replace(arguments.callee.sRE, '\\$1')
}

var newline = '__MU_NEWLINE__',
    newlineRegExp = new RegExp(newline, 'g')

var Parser = exports.Parser = function(options) {
  this.template = ''
  this.options  = options || {}
  
  this.sections = []
  this.tokens   = ['multi']
  this.partials = []
  this.buffer   = ''
  this.state    = 'static'; // 'static' or 'tag'
  this.currentLine = ''
  
  this.otag = '{{'
  this.ctag = '}}'
}

Parser.prototype = {
  // tokenize is the only publically available function
  tokenize: function () {
    while (this.buffer) {
      this.state === 'static' ? this.scanText() : this.scanTag()
    }
    
    if (this.sections.length) {
      throw new Error('Encountered an unclosed section.')
    }
    
    function logMulti(multi, indent1) {
      console.log(indent1 + '++ multi (' + multi.length + ')')
      var indent2 = indent1 + '  '
      // a multi's.slice(1:) is an array of arrays
      for (var i = 1; i < multi.length; i++) {
        var sub = multi[i]
        // console.log('sub[0] **************', sub[0])
        if (sub[0] == 'static') {
          var buffer = sub[2]
          var body = ''
          if (buffer.length > 80) {
            var start = buffer.toString('utf8', 0, 40)
            var end = buffer.toString('utf8', buffer.length - 41)
            body = start + '...' + end
          }
          else {
            body = buffer.toString('utf8')
          }
          console.log(indent2 + 'static: ' + body.replace(/\n/g, '\\n'))
        }
        else if (sub[0] == 'multi') {
          logMulti(sub, indent2)
        }
        else {
          console.log(indent2 + sub[0] + ' (' + sub.length + ')')
          var indent3 = indent2 + '  '
          for (var j = 0; j < sub.length; j++) {
            if (typeof(sub[j]) === 'string') {
              var body = sub[j].length > 80 ? (sub[j].slice(0, 80) + '...') : sub[j]
              console.log(indent3 + body.replace(/\n/g, '\\n'))
            }
            else if (Array.isArray(sub[j]) && sub[j][0] == 'multi') {
              logMulti(sub[j], indent3)
            }
            else {
              console.log(indent3 + util.inspect(sub[j]))
            }
          } 
        }
      }
    }
    // console.log('========== Parsed template ===========')
    // logMulti(this.tokens, '')
    return this.tokens
  },

  setTags: function(content) {
    // slice off the equals signs, and assume that there's a space between the two tags; something like: {{=<% %>=}}
    var parts = content.split(' ')
    this.otag = parts[0]
    this.ctag = parts[1]
  },
  
  parse: function(template) {
    this.template = template.replace(/\r?\n/g, newline)
    this.buffer = this.template
    return this.tokenize()
  },

  appendMultiContent: function (content) {
    for (var i = 0, len = this.sections.length; i < len; i++) {
      var multi = this.sections[i][1]
      multi = multi[multi.length - 1][3] += content
    }
  },
  
  scanText: function () {
    // Since we begin in text mode, this begins at the very start of the mu document, and scans up to and over the first {{
    var index = this.buffer.indexOf(this.otag)
    
    if (index === -1) {
      index = this.buffer.length
    }
    
    var content = this.buffer.substring(0, index).replace(newlineRegExp, '\n'),
        buffer  = new Buffer(Buffer.byteLength(content))
    
    if (content !== '') {
      buffer.write(content, 'utf8', 0)
      this.appendMultiContent(content)
      this.tokens.push(['static', null, buffer]) // null -> content
    }
   
    var line = this.currentLine + content

    this.currentLine = line.substring(line.lastIndexOf('\n') + 1, line.length)
    // console.log('line:', this.buffer.lastIndexOf(newline) + newline.length, index, '>', this.currentLine, '/end')
    this.buffer = this.buffer.substring(index + this.otag.length)
    this.state  = 'tag'
  },
  
  scanTag: function () {
      //   matcher = 
      // "^" +
      // "\\s*" +                           // Skip any whitespace
      //                                    
      // "(#|\\^|/|=|!|<|>|&|\\{)?" +       // Check for a tag type and capture it
      // "\\s*" +                           // Skip any whitespace
      // "([^(?:\\}?" + escapeRegex(ctag) + ")]+)" +  // Capture the text inside of the tag
      // "\\s*" +                           // Skip any whitespace
      // "\\}?" +                           // Skip balancing '}' if it exists
      // escapeRegex(ctag) +                          // Find the close of the tag
      //                                    
      // "(.*)$"                            // Capture the rest of the string
      // 
    var escaped_ctag = escapeRegex(this.ctag)
    // /(#|\\^|/|=|!|<|>|&|\\{)/ ==? /[#^/=!<>&{]/
    var matcher_str = "^\\s*(#|\\^|/|=|!|<|>|&|\\{)?\\s*([^(?:\\}?" + escaped_ctag + ")]+)\\s*\\}?" + escaped_ctag + "(.*)$"
    var matcher = new RegExp(matcher_str)
    
    var match = this.buffer.match(matcher)
    
    if (!match) {
      throw new Error('Encountered an unclosed tag: "' + this.otag + this.buffer + '"')
    }
    
    var sigil     = match[1],
        content   = match[2].trim(),
        remainder = match[3],
        tagText   = this.otag + this.buffer.substring(0, this.buffer.length - remainder.length)

    // console.log("Switching on sigil/content/tagText: " + sigil + ', ' + content + ', ' + remainder)
    
    switch (sigil) {
      case undefined:
        this.tokens.push(['mustache', 'etag', content])
        this.appendMultiContent(tagText)
        break
      
      case '>':
        // PARTIALs
        this.tokens.push(['mustache', 'partial', content])
        this.partials.push(content)
        this.appendMultiContent(tagText)
        break
      
      case '<':
        // INHERITANCE
        if (content !== 'yield')
          throw new Error('Yield statements must be marked "yield," not "' + content + '"')
        this.tokens.push(['mustache', 'yield', ''])
        this.appendMultiContent(tagText)
        break

      case '&':
        this.tokens.push(['mustache', 'utag', content])
        this.appendMultiContent(tagText)
        break
    
      case '!':
        // Ignore comments
        break
    
      case '=':
        // console.log("Changing tag: " + content)
        if (content[content.length - 1] === '=')
          content = content.slice(0, -1)
        this.setTags(content)
        this.appendMultiContent(tagText)
        break
    
      case '#':
      case '^':
        this.appendMultiContent(tagText)
        var type = sigil === '#' ? 'section' : 'inverted_section'
            block = ['multi']
      
        this.tokens.push(['mustache', type, content, '', block])
        this.sections.push([content, this.tokens])
        this.tokens = block
        break
    
      case '/':
        var res = this.sections.pop() || []
        var name = res[0], tokens = res[1]
      
        this.tokens = tokens
        if (!name) {
          throw new Error('Closing unopened ' + name)
        } else if (name !== content) {
          throw new Error("Unclosed section " + name)
        }
        this.appendMultiContent(tagText)
        break
    }
    
    this.buffer = remainder
    this.state  = 'static'
  }
}
