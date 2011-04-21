var BUFFER_LENGTH = 1024 * 8;

var sys    = require('sys'),
    fs     = require('fs'),
    path   = require('path'),
    pump   = require('util').pump,
    Stream = require('stream').Stream,
    parse  = require('./mu/parser').parse,
    render = require('./mu/renderer').render,
    errors = require('./mu/errors')

var mu = module.exports = {}
mu.BUFFER_LENGTH = 1024 * 8

mu.root = process.cwd();
/**
 * Items in mu.cache are keyed by filename.
 * Each item is an array of "tokens", mu.cache = {a: [...], b: [...]} // , partials: [...]
 * Things are stored in the cache WITHOUT a hierarchy
 */
function Cache() { }
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
  hit: function(name, callback) {
    var self = this;
    var cached = this[name]
    if (!cached) {
      compileFilename(name, function(err, compiled) {
        // store the compiled template before returning it.
        self[name] = compiled;
        return callback(undefined, compiled)
      })
    }
    return callback(undefined, cached)
  },
  hitSync: function(name) {
    var cached = this[name]
    if (!cached) {
      var compiled = compileFilenameSync(name);
      // store the compiled template before returning it.
      this[name] = compiled
      return compiled
    }
    return cached
  }
}
mu.cache = new Cache;


function resolveAndReadFile(filename, callback) {
  if (filename[0] !== '/')
    filename = path.join(mu.root, filename)
  fs.readFile(filename, 'utf8', callback);
}
function resolveAndReadFileSync(filename) {
  if (filename[0] !== '/')
    filename = path.join(mu.root, filename)
  return fs.readFileSync(filename, 'utf8');
}


/**
 * Compiles a file. The result will be cached as the filename and can be
 * rendered via that name.
 *
 * @param {String} filename The name of the file to compile. If the filename
 *        starts with a '/', the file is assumed to be absolute, else it is
 *        relative to mu.root.
 * @param {Function(err, Parsed)} callback The function to call when the file has been compiled.
 */
function compileFilename(name, callback) {
  resolveAndReadFile(name, function(err, file_contents) {
    if (err)
      return callback(err)
    return callback(undefined, parse(file_contents))
  })
}
function compileFilenameSync(name) {
  var file_contents = resolveAndReadFileSync(name)
  return parse(file_contents)
}

// function normalizeNameHierarchy(names) {
//   if (Array.isArray(filenames))
//     return filenames.join(':')
//   else
//     return filenames
// }

  // var unique = unique || {}
  

    // if (err)
    //   return callback(err) // new Error('file_not_found') // errors.fileNotFound(mu.root, filename, err)));
    
    // var parsed = mu.cache[name] = 

    // var i = 0
    // (function next(err) {
    //   if (err)
    //     return callback(err)
    // 
    //   if (i < parsed.partials.length) {
    //     mu.compile(parsed.partials[i], next)
    //     i++
    //     
    //   } else {
    //     callback(undefined, parsed)
    //   }
    // }());

/**
 * Compiles a string into the parsed form. If `name` is provided the text
 * will be cached by that name. Alternatively you can pass the return
 * into mu.render.
 *
 * @param {String} name (Optional) The name to cache the parsed form as.
 * @param {String} template The template to parse.
 * @param {Function(err, Parsed)} callback (Optional) An optional callback that
 *        will be called when the text is parsed. This is only to unify the
 *        API with mu.compile.
 *
 * @returns {Parsed} The parsed template unless `callback` is provided.
 */
// mu.compileText = function (name, template, callback) {
//   var parsed;
//   
//   if (typeof template === 'undefined') {
//     template = name;
//     name = undefined;
//   }
//   
//   try {
//     parsed = parser.parse(template);
//     
//     if (name) {
//       mu.cache[name] = [parsed, {}];
//     }
// 
//     if (callback) callback(undefined, parsed); else return parsed;
//     
//   } catch (err) {
//     if (callback) callback(err); else throw err;
//   }
// }

function beginRender(names, context, cache) {
  // console.log("beginningRender with names = " + names);
  var stream = new Stream();

  process.nextTick(function () {
    // split up the hierarchy into two parts: the first and then the remainder. fetch the cached value for the former.
    var tokens = cache.hitSync(names[0]);
    try {
      // this function calls itself recursively, if the yield pattern (names.length > 0) dictates so
      render(tokens, names.slice(1), context, cache, stream, function () {
        stream.emit('end');
      });
    } catch (err) {
      stream.emit('error', err);
    }
  })
  
  return stream
}

/**
 * Renders a stream that the template will be asynchronously rendered to. It starts 
 * rendering to it on a process.nextTick, so this will return quickly.
 *
 * @param {String} names filename(s) to render. Can be either array or single string.
 * @param {Object} context The data to use when renderings.
 *
 * @returns {Stream} The render stream.
 * @throws {Error(template_not_in_cache)} If filename was not found in cache.
 */
mu.render = function(names, context) {
  // console.log("beginning mu.render with names = " + names);
  if (!names instanceof Array)
    names = [names]
  
  return beginRender(names, context, mu.cache)
}


// function (name, context, writableStream)
// mu.renderToStream = function(names, context, writableStream) {
//   if (writableStream === undefined && hierarchy instanceof Stream) {
//     writableStream = hierarchy
//     hierarchy = undefined
//   }
//   // pump(mu.render(name, context), writableStream)
//   mu.render(name, context, hierarchy).pipe(writableStream)
// }

// mu.renderText = function (template, context, partials) {
//   var name, parsed, tokens, stream;
//   
//   partials = partials || {};
//   partials = shallowCopy(partials);
//   partials.__proto__ = mu.cache;
//   
//   for (name in partials) {
//     if (partials.hasOwnProperty(name) && !partials[name].tokens) {
//       partials[name] = parser.parse(partials[name]);
//     }
//   }
//   
//   parsed = parser.parse(template);
//   tokens = parsed.tokens;
//   
//   return beginRender(tokens, context, partials);
// }


/// Private API

// function beginRender(tokens, view, partials) {
//   var stream = new Stream();
//   var count = 0;
//   
//   process.nextTick(function () {
//     try {
//       renderer.render(tokens, view, partials, stream, function () {
//         stream.emit('end');
//       });
//     } catch (err) {
//       stream.emit('error', err);
//     }
//   });
//   
//   return stream;
// }

// function shallowCopy(obj) {
//   var o = {};
//   
//   for (var key in obj) {
//     if (obj.hasOwnProperty(key)) {
//       o[key] = obj[key];
//     }
//   }
//   
//   return o;
// }
