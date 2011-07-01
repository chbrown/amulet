var EventEmitter = require('events').EventEmitter
var Stream = require('stream').Stream
var parser = require('./parser')
var util = require('util')
exports.root = parser.root
exports.parseTemplate = parser.parseTemplate

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, function(s) {
    switch (s) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '"': return '&quot;'
      default: return s
    }
  })
}

// _insertProto takes an object, @new_proto, and sort of stages that behind @object itself, such that @object's properties obscure any properties @new_proto might already have, but if @new_proto has any properties that @object doesn't have, they shine through as if they were properties of @object.
// Also, it inserts it at the very end, so that all of object's __proto__'s, if there are any, come before.
var default_object_proto = ({}).__proto__
function _insertProto(object, new_proto) {
  // new_proto, presumably, has a bottom-level proto equivalent to `default_object_proto`
  if (object === new_proto) {
    // do nothing
  }
  else if (object.__proto__ === default_object_proto) {
    try {
      object.__proto__ = new_proto
    }
    catch (err) {
      console.log("Can't make that your proto, silly.")
      console.log('++++++++++ object', util.inspect(object, true, null))
      console.log('++++++++++ new_proto', util.inspect(new_proto, true, null))
    }
  }
  else if (object.__proto__ === new_proto) {
    // why the hell does this happen?
    //console.log("object.__proto__ === new_proto, cool (WEIRD though)")
    // do nothing
  }
  else {
    _insertProto(object.__proto__, new_proto)
  }

}

// function resolve(context, path) {
//   var index = path.indexOf('.')
//   console.log("resolve:", path)
//   if (index !== -1) {
//     var base = path.substr(0, index)
//     var next_context = context[base] // the "base" part of "base.sub"
//     console.log("typeof:", base, "-->", typeof(next_context))
//     if (next_context === undefined)
//       console.log('undefined context', context)
//     if (path === "posts.first") {
//     }
//     if (typeof(next_context) === 'function') {
//       next_context = next_context() //  // item(block) ?(block) ?
//     }
//     if (next_context) {
//       return resolve(next_context, path.substr(index + 1)) // the "sub" part of "base.sub"
//     }
//     return next_context
//   }
//   return context[path]
// }

function copyProperties(from, to) {
  for (attr in from)
    to[attr] = from[attr]
}


var Renderer = exports.Renderer = function(context, pipe_to, asap) {
  this.context = context
  this.stream = new Stream()
  this.asap = asap

  if (pipe_to)
    this.stream.pipe(pipe_to)
}
Renderer.prototype = new EventEmitter

Renderer.prototype.addContext = function(name, value) {
  this.context[name] = value
  this.emit('bump')
  return this // chainable
}
Renderer.prototype.extendContext = function(dictionary) {
  copyProperties(dictionary, this.context)
  this.emit('bump')
  return this // chainable
}
Renderer.prototype.force = function() {
  // use force to quit waiting for new context variables, and simply leave gaps for missing context variables, where possible
  this.asap = false
  this.emit('bump')
  return this // chainable
}

Renderer.prototype.render_global = function(names, callback) {
  var renderer = this
  return this.render_names(names, this.context, function(err) {
    if (err) throw err
    renderer.stream.emit('end')
    return callback ? callback(undefined) : true
  })
}
Renderer.prototype.render_names = function(names, context, callback) {
  // console.log("Rendering names:", util.inspect(names, false, null))
  var tokens = parser.hitCache(names[0])
  return this.render_tokens(tokens, names.slice(1), context, callback)
}
Renderer.prototype.render_tokens = function(tokens, yield_names, context, callback) {
  // console.log("Rendering tokens:", util.inspect(tokens, false, null))
  var renderer = this
  var i = 0;
  (function next() {
    try {
      var token = tokens[i++]

      if (token === undefined) {
        // we're done! (with this scope)
        return callback ? callback(undefined) : true
      }

      // token = (command, variable, block)
      // console.log(token)
      var command = token[0]
      var variable = token[1]
      if (command === 'raw') {
        renderer.stream.emit('data', variable)
        return next()
      }
      else if (command === 'partial') {
        // what about partials with variables for names?
        return renderer.render_names([variable], context, next)
      }
      else if (command === 'yield') {
        if (yield_names[0] === undefined)
          throw new Error('Cannot yield nothing')
        // console.log("Yielding:", util.inspect(yield_names, false, null))
        return renderer.render_names(yield_names, context, next)
      }
      else {
        (function bump() {
          // resolve, whether or not its a function
          // if variable has no periods, this just returns context[variable].
          // otherwise, it will drill down into context object by object
          // if (!variable)
            // console.log(variable, ' does not exist', command, '::', token)
          // var item = resolve(context, variable)
          // var index = path.indexOf('.')
          var item = context
          var splits = variable.split('.')
          for (var i = 0, len = splits.length; i < len; i++) {
            new_item = item[splits[i]]
            // if (splits[i].match('posts'))
            //   console.log(splits[i], " ==> ", splits, ' ==> ', item, ' type:', typeof(item))
            // if (splits[i].match('first'))
            //   console.log(splits[i], " ==> ", splits, ' ==> ', item, ' type:', typeof(item))
            if (typeof(new_item) === 'function') {
              item = new_item.apply(item) // item(block) ?(block) ?
            }
            else {
              item = new_item
            }

            if (!item) 
              break
          }

          if (item === undefined) {
            // this.asap can be true if we want to wait, 
            // and false if we merely want to ignore the missing context vars.
            if (renderer.asap) {
              renderer.once('bump', bump) // wait
              return
            }
            else {
              item = ''
            }
          }
          else if (item === null) {
            // is this the best idea?
            item = ''
          }

          if (command === 'unescaped') {
            renderer.stream.emit('data', item.toString())
            return next()
          }
          else if (command === 'escaped') {
            renderer.stream.emit('data', escapeHtml(item.toString()))
            return next()
          }
          else if (command === 'section' || command === 'inverted_section') {
            var enabled = command === 'inverted_section' ? !item : item
            if (enabled) {
              var block = token[2]
              // console.log("Entering section with item:", typeof(item), item instanceof Array, "and block:", block)
              // console.log('sectioning for', item)
              if (item instanceof Array) {
                var i = 0;
                (function next2() {
                  var next_context = item[i++]
                  if (next_context) {
                    if (typeof(next_context) !== 'object') {
                      //=== 'string' || typeof(next_context) === 'number'
                      next_context = {'_': next_context}
                    }
                    _insertProto(next_context, context)
                    return renderer.render_tokens(block, [], next_context, next2)
                  }
                  return next()
                })()
              }
              else {
                if (typeof(item) !== 'object') {
                  // for strings, numbers, booleans, etc.
                  item = {'_': item}
                }
                // console.log("non array section:", typeof(item), ":", item, ";", context)
                // if (item == context)
                  // console.log('WTF', variable)
                // console.log('non array section _insertProto', item.__proto__, context)
                _insertProto(item, context)
                return renderer.render_tokens(block, [], item, next)
              }
            }
            else {
              // should this be in an else?
              // if it's lower, it'll keep going even if the template below stops for a bump (BAD!)
              return next()
            }
          }
        })()
      }
    } catch (err) {
      renderer.stream.emit('error', err)
      next()
    }
  })()
}
