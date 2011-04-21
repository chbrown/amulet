var sys    = require('sys'),
    Buffer = require('buffer').Buffer

var lib = require('./lib'),
    escapeRegex = lib.escapeRegex

var newline = '__MU_NEWLINE__',
    newlineRegExp = new RegExp(newline, 'g')

exports.parse = function(template, options) {
  var parser = new Parser(template, options);
  return parser.tokenize();
}

function Parser(template, options) {
  this.template = template.replace(/\n/g, newline);
  this.options  = options || {};
  
  this.sections = [];
  this.tokens   = ['multi'];
  this.partials = [];
  this.buffer   = this.template;
  this.state    = 'static'; // 'static' or 'tag'
  this.currentLine = '';
  
  this.setTag(['{{', '}}']);
}

Parser.prototype = {
  // tokenize is the only publically available function
  tokenize: function () {
    while (this.buffer) {
      this.state === 'static' ? this.scanText() : this.scanTag();
    }
    
    if (this.sections.length) {
      throw new Error('Encountered an unclosed section.');
    }
    
    // return {partials: this.partials, tokens: this.tokens};
    return this.tokens;
  },

  appendMultiContent: function (content) {
    for (var i = 0, len = this.sections.length; i < len; i++) {
      var multi = this.sections[i][1];
      multi = multi[multi.length - 1][3] += content;
    }
  },
  
  setTag: function (tags) {
    this.otag = tags[0] || '{{';
    this.ctag = tags[1] || '}}';
  },
  
  scanText: function () {
    // Since we begin in text mode, this begins at the very start of the mu document, and scans up to and over the first {{
    var index = this.buffer.indexOf(this.otag);
    
    if (index === -1) {
      index = this.buffer.length;
    }
    
    var content = this.buffer.substring(0, index).replace(newlineRegExp, '\n');
        buffer  = new Buffer(Buffer.byteLength(content));
    
    if (content !== '') {
      buffer.write(content, 'utf8', 0);
      this.appendMultiContent(content);
      this.tokens.push(['static', content, buffer]);
    }
   
    var line = this.currentLine + content;

    this.currentLine = line.substring(line.lastIndexOf('\n') + 1, line.length);
    // console.log('line:', this.buffer.lastIndexOf(newline) + newline.length, index, '>', this.currentLine, '/end');
    this.buffer = this.buffer.substring(index + this.otag.length);
    this.state  = 'tag';
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
      // ;
    var escaped_ctag = escapeRegex(this.ctag)
    var matcher = "^\\s*(#|\\^|/|=|!|<|>|&|\\{)?\\s*([^(?:\\}?" + escaped_ctag + ")]+)\\s*\\}?" + escaped_ctag + "(.*)$";
    matcher = new RegExp(matcher);
    
    var match = this.buffer.match(matcher);
    
    if (!match) {
      throw new Error('Encountered an unclosed tag: "' + this.otag + this.buffer + '"');
    }
    
    var sigil     = match[1],
        content   = match[2].trim(),
        remainder = match[3],
        tagText   = this.otag + this.buffer.substring(0, this.buffer.length - remainder.length);

    // console.log("Switching on sigil/content/tagText: " + sigil + ', ' + content + ', ' + remainder);
    
    switch (sigil) {
      case undefined:
        this.tokens.push(['mustache', 'etag', content]);
        this.appendMultiContent(tagText);
        break;
      
      // '<' is for partials, because it's PULLing in the content from the partial
      case '<':
        this.tokens.push(['mustache', 'partial', content]);
        this.partials.push(content);
        this.appendMultiContent(tagText);
        break;
      
      // '>' is for inheritance, because it's PUSHing the layout into the actual template.
      case '>':
        this.tokens.push(['mustache', 'yield', 'n/a']);
        this.appendMultiContent(tagText);
        break;

      case '&':
        this.tokens.push(['mustache', 'utag', content]);
        this.appendMultiContent(tagText);
        break;
    
      case '!':
        // Ignore comments
        break;
    
      case '=':
        sys.puts("Changing tag: " + content)
        this.setTag(content.split(' '));
        this.appendMultiContent(tagText);
        break;
    
      case '#':
      case '^':
        this.appendMultiContent(tagText);
        var type = sigil === '#' ? 'section' : 'inverted_section';
            block = ['multi'];
      
        this.tokens.push(['mustache', type, content, '', block]);
        this.sections.push([content, this.tokens]);
        this.tokens = block;
        break;
    
      case '/':
        var res    = this.sections.pop() || [],
            name   = res[0],
            tokens = res[1];
      
        this.tokens = tokens;
        if (!name) {
          throw new Error('Closing unopened ' + name);
        } else if (name !== content) {
          throw new Error("Unclosed section " + name);
        }
        this.appendMultiContent(tagText);
        break;
    }
    
    this.buffer = remainder;
    this.state  = 'static';
  }
}
