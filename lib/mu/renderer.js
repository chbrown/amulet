var EventEmitter = require('events').EventEmitter
var util = require('util')
var Stream = require('stream').Stream

var cache = null // this will be replaced, on loading mu.js, with the actual cache
exports.setCache = function(global_cache) {
  cache = global_cache
}
  

function _escapeReplaceHtml(s) {
  switch (s) {
    case '<': return '&lt;'
    case '>': return '&gt;'
    case '&': return '&amp;'
    case '"': return '&quot;'
    default: return s
  }
}

function escape(s) {
  return s.replace(/[&<>"]/g, _escapeReplaceHtml)
}

// _insertProto takes an object, @new_proto, and sort of stages that behind @object itself, such that @object's properties obscure any properties @new_proto might already have, but if @new_proto has any properties that @object doesn't have, they shine through as if they were properties of @object.
var default_object_proto = ({}).__proto__
function _insertProto(object, new_proto) {
  // console.log("12198... inserting proto: ", new_proto)
  // console.log("for: ", object)
  // var orig_object = object
  // var old_object
  // try {
  while (object.__proto__ !== default_object_proto) {
    old_object = object
    object = object.__proto__
  }
  // }
  // catch (err) {
  //   console.log('147 err: ', err)
  //   console.log('Orig: ', orig_object)
  // }
  object.__proto__ = new_proto
}

// function to_s(val) {
//   return typeof val === 'undefined' ? '' : val.toString()
// }

// function resolve(context, name, arguments) {
//   var val = context[name]
//   if (typeof(val) === 'function') {
//     val = context[name](arguments)
//   }
//   return val
// }



/**
 * Renders the previously parsed filename or the parsed object.
 *
 * @param {Array} names The filenames (cache keys) of the cached templates to use, ['grandparent', 'parent', 'child']
 * @param {Object} context The data to use when rendering.
 * @param {Object} cache The cache from which to retrieve partials/layouts.
 * @param {Stream} stream The stream to output everything to.
 * @param {Function} callback What to call when we're done.
 *
 * @returns {Nothing} But that's okay because it's triggered in a process.nextTick.
 * @throws {Error(template_not_in_cache)} If filename was not found in cache.
 */


    
function copyProperties(from, to) {
  for (attr in from)
    to[attr] = from[attr]
}


var Renderer = exports.Renderer = function(context, pipe_to, asap) { 
  this.context = context
  this.stream = new Stream()
    // console.log("Just created!")
    // console.log("this.stream.writable: " + this.stream.writable)
    // console.log("this.stream.readable: " + this.stream.readable)
    // console.dir(this.stream)
  this.asap = asap
  
  if (pipe_to)
    this.stream.pipe(pipe_to)
}
Renderer.prototype = new EventEmitter

Renderer.prototype.addContext = function(name, value) {
  this.context[name] = value
  this.emit('bump')
}
Renderer.prototype.extendContext = function(dictionary) {
  copyProperties(dictionary, this.context)
  this.emit('bump')
}
Renderer.prototype.force = function() {
  // use force to quit waiting for new context variables, and simply leave gaps for missing context variables, where possible
  this.asap = false
  this.emit('bump')
}
Renderer.prototype.render_global = function(names, callback) {
  var renderer = this
  return this.render_names(names, this.context, function(err) {
    if (err) throw err
      // console.log("renderer.stream.writable: " + renderer.stream.writable)
      // console.log("renderer.stream.readable: " + renderer.stream.readable)
      // console.dir(renderer.stream)
    renderer.stream.emit('end')
    return callback ? callback(undefined) : true
  })
}
Renderer.prototype.render_names = function(names, context, callback) {
  var tokens = cache.hitSync(names[0])
  return this.render_tokens(tokens, names.slice(1), context, callback)
}
Renderer.prototype.render_tokens = function(tokens, yield_names, context, callback) {
  var renderer = this

  // if (tokens[0] !== 'multi') {
  //   throw new Error('Mu - WTF did you give me? I expected mustache tokens.')
  // }
  
  var i = 1
  
  function next() {
    try {
      // Not sure what this does, so it's out. For now.
      // if (renderer.stream.paused) {
      //   renderer.stream.on('drain', function () {
      //     process.nextTick(next)
      //   })
      //   return
      // }
  
      var token = tokens[i++]
  
      if (token === undefined) {
        // we're done! (with this scope)
        return callback ? callback(undefined) : true
      }
    
      // token = [<static/mustache>, <tag>, (<content>,) (<section-contents>)]
      var content = token[2]
      if (token[0] === 'static') {
        renderer.stream.emit('data', content)
        return next()
      }
      else { // 'mustache'
        var tag = token[1]
        if (tag === 'partial') {
          // partials cannot have inheritance, for the moment (would be easy to add), so rendering is simple:
          return renderer.render_names([content], context, next)
        }
        else if (tag === 'yield') {
          if (yield_names[0] === undefined)
            throw new Error('Cannot yield nothing')
          return renderer.render_names(yield_names, context, next)
        }
        else {
          // resolve, whether or not its a function
          function bump() {
            var item = context[content]
            // console.log("rendering section item with: " + util.inspect(item, true, null))
            if (typeof(item) === 'function') {
              item = item(token[3])
            }
            
            if (item === undefined) {
              // this.asap can be true if we want to wait, and false if we merely want to ignore the missing context vars.
              if (renderer.asap) {
                renderer.once('bump', bump) // wait
                // console.log('waiting for bump, need: ' + content + '; have: ' + util.inspect(context))
                return
              }
              else {
                item = ''
              }
            }
            
            if (tag === 'utag' || tag === 'etag') {
              item = item.toString()
              if (tag === 'etag')
                item = escape(item)
              renderer.stream.emit('data', item)
              return next()
            }
            else if (tag === 'section' || tag === 'inverted_section') {
              // console.log("Processing section, res: " + util.inspect(res) + " -- token[4]: " + util.inspect(token[4]))
              var enabled = tag === 'inverted_section' ? !item : item
              if (enabled)
                return renderer.render_section(item, context, token[4], next)
              else
                return next()
            }
          }
          bump()
        }
      }
    } catch (err) {
      renderer.stream.emit('error', err)
      next()
    }
  }
  next()
}
// not supposed to be used publicly, though. Must be local because render_tokens is, well, sort of local.
// @callback MUST be callable
Renderer.prototype.render_section = function(item, context, section_tokens, callback) {

  // if (typeof val === 'boolean') {
  //   return val ? render(tokens, context, cache, stream, callback) : callback()
  // }
  // console.log("in section fn: " + util.inspect(val, true, null))
  if (item instanceof Array) {
    var renderer = this
    var i = 0
    function next() {
      // if (item) {
        // var proto = _insertProto(item, context)
        // (tokens, next_names, context, stream, callback)
        
        // function () {
          // proto.__proto__ = baseProto
          // next()
        // })
      // } else {
      //   callback()
      // }
      
      var next_context = item[i++]
      if (next_context) {
        if (typeof(next_context) === 'string' || typeof(next_context) === 'number')
          next_context = {'.': next_context}
          
        try {
        _insertProto(next_context, context)
        } catch (err) {console.log(item); console.log(context); throw err}
        return renderer.render_tokens(section_tokens, [], next_context, next)
      }
      return callback()
      // console.log("rendering section item with: " + util.inspect(item, true, null))
      // var next_callback = i >= item.length ? callback : next
      
    }
    return next()
  } 
  else if (typeof(item) === 'object') {
    // var proto = _insertProto(val, context)
    // proto.__proto__ = baseProto
    // return
    var next_context = item
    _insertProto(next_context, context)
    return this.render_tokens(section_tokens, [], next_context, callback)
  }
  else if (item) {
    return this.render_tokens(section_tokens, [], context, callback)
  }
  return callback()
}




//
//
//
// function findInContext(context, key) {
//   var i = context.length
//   while (i--) {
//     if (context[i][key]) {
//       return context[i][key]
//     }
//   }
// 
//   return undefined
// }




// function _insertProto(obj, newProto, replaceProto) {
//   replaceProto = replaceProto || defaultObjProto
//   var proto = obj.__proto__
//   while (proto !== replaceProto) {
//     obj = proto
//     proto = proto.__proto__
//   }
//   obj.__proto__ = newProto
//   return obj
// }



