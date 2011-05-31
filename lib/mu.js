var sys    = require('sys'),
    fs     = require('fs'),
    path   = require('path'),
    Parsers = require('./mu/parser'),
    Renderers = require('./mu/renderer')

exports.BUFFER_LENGTH = 1024 * 8
var root = exports.root = process.cwd()

/**
 * Items in mu.cache are keyed by filename.
 * Each item is an array of "tokens", mu.cache = {a: ["multi", ...], b: ["multi", ...]}
 * Things are stored in the cache WITHOUT a hierarchy. ONE (and only one) per file!
 */
function Cache() {
  // I have to make Parsers a local since I have to be able to use the Cache object 
  // from the renderers sub-module (this means that everything that renderers needs
  // to be able to call inside Cache must not reference any globals! (except maybe modules,
  // it seems like the fs.* calls work just fine.)
  this.Parsers = Parsers
  this.root = root
}

Cache.prototype = {
  /**
   * Compiles a file. The result will be cached as the filename and can be
   * rendered via that name.
   *
   * @param {String} filename The name of the file to compile. If the filename
   *        starts with a '/', the file is assumed to be absolute, else it is
   *        relative to mu.root.
   * @param {Function(err, Parsed)} callback The function to call when the file has been compiled.
   */
  compileFilename: function(filename, callback) {
    var cache = this
    if (filename[0] !== '/')
      filename = path.join(cache.root, filename)
    fs.readFile(filename, 'utf8', function(err, file_contents) {
      if (err)
        return callback(err)
      // use the local Parsers (this/cache.Parsers
      var parser = new cache.Parsers.Parser() // attach options to the parser here, if needed
      return callback(undefined, parser.parse(file_contents))
    })
  },
  /**
   * Hits the in-Node cache to see if the template exists. If it does, this'll 
   * call the callback pretty quickly, but if there's a cache miss, it'll have
   * to read the file and then parse it (compileFilename).
   *
   * @param {String} name The name of the file to compile. If the filename
   *        starts with a '/', the file is assumed to be absolute, else it is
   *        relative to mu.root.
   * @param {Function(err, Parsed)} callback The function to call when the file has been found/compiled.
   */
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
  compileFilenameSync: function(filename) {
    if (filename[0] !== '/')
      filename = path.join(this.root, filename)
    var file_contents = fs.readFileSync(filename, 'utf8')
    var parser = new this.Parsers.Parser
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
var cache = exports.cache = new Cache // the cache is a singleton, btw
Renderers.setCache(cache)







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
exports.render = function(names, options) {
  options = options || {}
  options.__proto__ = { context: {}, asap: false, pipe_to: undefined, callback: null }

  // if names is 1-long, it can be provided as a simple string (which we normalize to an array here)
  if (!names instanceof Array)
    names = [names]
    
  // asap == true for asap rendering, defaults to false, if not provided
  var renderer = new Renderers.Renderer(options.asap)
  
  process.nextTick(function () {
    // split up the hierarchy into two parts: the first and then the remainder. fetch the cached value for the former.
    try {
      // this function recurses on itself, if the yield pattern (names.length > 0) dictates so
      renderer.render(names, context, function () {
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
  
  if (options.pipe_to)
    renderer.stream.pipe(options.pipe_to)
    
  return renderer
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
