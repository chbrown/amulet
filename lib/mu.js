var sys    = require('sys'),
    fs     = require('fs'),
    path   = require('path'),
    Parser = require('./mu/parser').Parser,
    renderers = require('./mu/renderer'),
    Renderer = renderers.Renderer

exports.root = process.cwd()
// if I say var root = exports.root = etc., then root doesn't change if someone changes exports.root from a using module.

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
  this.Parser = Parser
  // this.root = root
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
  // compileFilename: function(filename, callback) {
  //   var cache = this
  //   if (filename[0] !== '/')
  //     filename = path.join(cache.root, filename)
  //   fs.readFile(filename, 'utf8', function(err, file_contents) {
  //     if (err)
  //       return callback(err)
  //     // must call cache, not "this"
  //     var compiled = cache.compileStringSync(file_contents)
  //     return callback(undefined, compiled)
  //   })
  // },
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
  // hit: function(name, callback) {
  //   var self = this
  //   var cached = this[name]
  //   if (!cached) {
  //     this.compileFilename(name, function(err, compiled) {
  //       // store the compiled template before returning it.
  //       self[name] = compiled
  //       return callback(undefined, compiled)
  //     })
  //   }
  //   else {
  //     return callback(undefined, cached)
  //   }
  // },
  compileFilenameSync: function(name) {
    var file_path = name[0] === '/' ? name : path.join(exports.root, name)
    var template_string = fs.readFileSync(file_path, 'utf8')
    return this.compileStringSync(name, template_string)
  },
  compileStringSync: function(name, template_string) {
    return this[name] = new this.Parser().parse(template_string)
  },
  hitSync: function(name) {
    return this[name] || this.compileFilenameSync(name)
  }
}
var cache = exports.cache = new Cache // the cache is a singleton, btw
renderers.setCache(cache)







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


// context = {}, pipe_to = null, but both required for signature simplicity, only asap is optional
// asap = true means that the renderer will pause if the template asks for anything in the context that isn't there yet.
// Valid signatures:
//   function(name(s), context, pipe_to, asap, callback)
//   function(name(s), context, pipe_to, callback)
exports.render = function(names, context, pipe_to, asap, callback) {
  // if names is 1-long, it can be provided as a simple string (which we normalize to an array here)
  if (!names instanceof Array) {
    names = [names]
  }
  if (asap && asap.call) {
    callback = asap
    asap = false
  }

  // this shouldn't take any time at all, really.
  var renderer = new Renderer(context, pipe_to, asap)
  
  process.nextTick(function () {
    try {
      // names get thrown in here, because they take longer
      renderer.render_global(names, callback)
    } catch (err) {
      renderer.stream.emit('error', err)
      if (callback)
        callback(err)
    }
  })
    
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
