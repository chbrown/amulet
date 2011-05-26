var sys    = require('sys'),
    fs     = require('fs'),
    path   = require('path'),
    Stream = require('stream').Stream,
    parser_factory = require('./mu/parser'),
    renderer_factory = require('./mu/renderer'),
    errors = require('./mu/errors')

exports.BUFFER_LENGTH = 1024 * 8
var root = exports.root = process.cwd()

/**
 * Items in mu.cache are keyed by filename.
 * Each item is an array of "tokens", mu.cache = {a: [...], b: [...]} // , partials: [...]
 * Things are stored in the cache WITHOUT a hierarchy
 */
function Cache() {
  this.parser_factory = parser_factory 
}
/**
 * Hits the in-Node cache to see if the template exists. If it does, this'll 
 * call the callback pretty quickly, but if there's a cache miss, it'll have
 * to read the file and then parse it.
 *
 * @param {String} name The name of the file to compile. If the filename
 *        starts with a '/', the file is assumed to be absolute, else it is
 *        relative to mu.root.
 * @param {Function(err, Parsed)} callback The function to call when the file has been found/compiled.
 */
Cache.prototype = {
  resolveAndReadFile: function(filename, callback) {
    if (filename[0] !== '/')
      filename = path.join(root, filename)
    fs.readFile(filename, 'utf8', callback)
  },
  compileFilename: function(name, callback) {
    this.resolveAndReadFile(name, function(err, file_contents) {
      if (err)
        return callback(err)
      var parser = new this.parser_factory.Parser()
      return callback(undefined, parser.parse(file_contents))
    })
  },
  hit: function(name, callback) {
    var self = this
    var cached = this[name]
    if (!cached) {
      this.compileFilename(name, function(err, compiled) {
        // store the compiled template before returning it.
        self[name] = compiled
        return callback(undefined, compiled)
      })
    }
    else {
      return callback(undefined, cached)
    }
  },
  resolveAndReadFileSync: function(filename) {
    if (filename[0] !== '/')
      filename = path.join(exports.root, filename)
    return fs.readFileSync(filename, 'utf8')
  },
  compileFilenameSync: function(name) {
    // console.log('this.resolveAndReadFileSync === undefined?' + this.resolveAndReadFileSync === undefined)
    var file_contents = this.resolveAndReadFileSync(name)
    // process.stdout.write("Got file contents: " + file_contents)
    var parser = new this.parser_factory.Parser()
    // process.stdout.write("Really Done")
    return parser.parse(file_contents)
  },
  hitSync: function(name) {
    var cached = this[name]
    if (!cached) {
      var compiled = this.compileFilenameSync(name)
      // store the compiled template before returning it.
      this[name] = compiled
      return compiled
    }
    return cached
  }
}
var cache = exports.cache = new Cache
renderer_factory.setCache(cache)




/**
 * Compiles a file. The result will be cached as the filename and can be
 * rendered via that name.
 *
 * @param {String} filename The name of the file to compile. If the filename
 *        starts with a '/', the file is assumed to be absolute, else it is
 *        relative to mu.root.
 * @param {Function(err, Parsed)} callback The function to call when the file has been compiled.
 */



/**
 * Creates a stream that the template will be asynchronously rendered to. It starts 
 * rendering to it on a process.nextTick, so this will return quickly. Unlike start_render,
 * below, it will render as quickly as possible, and the context cannot be changed.
 *
 * @param {String} names filename(s) to render. Can be either array or single string.
 *                       It will render the hierarchy descendingly, eg. [grandfather, father, child]
 * @param {Object} context The data to use when renderings.
 * @param {Function} callback The function to call back when the stream is finished rendering
 *
 * @returns {Stream} The render stream.
 * @throws {Error(template_not_in_cache)} If filename was not found in cache.
 */
// exports.render_simple = function(names, context, callback) {
//   // console.log("beginning mu.render with names = " + names)
//   if (!names instanceof Array)
//     names = [names]
//   
//   // return beginRender(names, context, mu.cache, callback)
// 
//   var stream = new Stream()
// 
//   process.nextTick(function () {
//     // split up the hierarchy into two parts: the first and then the remainder. fetch the cached value for the former.
//     try {
//       // this function recurses on itself, if the yield pattern (names.length > 0) dictates so
//       default_renderer.render(names, context, stream, function () {
//         stream.emit('end')
//         if (callback) 
//           callback(undefined, null)
//       })
//     } catch (err) {
//       stream.emit('error', err)
//       if (callback)
//         callback(err, null) 
//     }
//   })
//   
//   return stream
// }
// returns a tuple: [stream, controller], where the controller is an object with two functions:
//  add(name, value) where the value is inserted as context[name], and 
//  force(), which you must call when you're done with everything to keep the renderer from stalling, if you decide to leave
//    some empty values in the context


// signatures (type-based disambiguation):
//  0:   render(names, context, asap,    pipe_to, callback)
//  1:   render(names, context, asap,    pipe_to)
//  2:   render(names, context, pipe_to, callback)
//  2.5: render(names, context, pipe_to)
//  3:   render(names, context, asap,    callback)
//  4:   render(names, context, callback)
//  5:   render(names, asap)
//  6:   render(names, context)
//  7:   render(names)
exports.render = function(names, context, asap, pipe_to, callback) {
  // if names is 1-long, it can be provided as a simple string (which we'll normalize here)
  if (!names instanceof Array)
    names = [names]
  
  // 2, 2.5, 3, 4
  if (callback === undefined) {
    // 2, 2.5
    if (asap instanceof Stream) {
      // 2
      if (pipe_to.call)
        callback = pipe_to
      // 2 & 2.5
      pipe_to = asap
      asap = false
    }
    // 3
    else if (pipe_to.call) {
      callback = pipe_to
    }
    // 4
    else if (asap.call) {
      callback = asap
      asap = false
    }
  }
  
  // 5
  if (context === true || context === false) {
    asap = context
    context = {}
  }
  // 6
  else if (asap === undefined) {
    asap = false
  }
  // 7
  if (context === undefined) {
    context = {}
  }
  
  // cache is module-wide, but this is the best way I know how to get it into my submodule
  // asap == true for asap rendering, defaults to false, if not provided
  var renderer = new renderer_factory.Renderer(asap)
  
  var stream = new Stream

  process.nextTick(function () {
    // split up the hierarchy into two parts: the first and then the remainder. fetch the cached value for the former.
    try {
      // this function recurses on itself, if the yield pattern (names.length > 0) dictates so
      renderer.render(names, context, stream, function () {
        stream.emit('end')
        if (callback)
          callback(undefined, null)
      })
    } catch (err) {
      stream.emit('error', err)
      if (callback)
        callback(err, null) 
    }
  })
  
  if (pipe_to)
    stream.pipe(pipe_to)
    
  // as a way of returning two values un-awkwardly (return [stream, renderer.controller]; is awkward),
  // I'll simply pin the controller on the stream with a new property. For most people, they'll never need it.
  stream.controller = renderer.controller
  return stream
}

// mu.renderText = function (template, context, partials) {
//   var name, parsed, tokens, stream
//   
//   partials = partials || {}
//   partials = shallowCopy(partials)
//   partials.__proto__ = mu.cache
//   
//   for (name in partials) {
//     if (partials.hasOwnProperty(name) && !partials[name].tokens) {
//       partials[name] = parser.parse(partials[name])
//     }
//   }
//   
//   parsed = parser.parse(template)
//   tokens = parsed.tokens
//   
//   return beginRender(tokens, context, partials)
// }
