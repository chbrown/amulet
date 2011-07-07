var EventEmitter = require('events').EventEmitter
var Stream = require('stream').Stream
var parse = require('./parse')
var util = require('util')
exports.root = parse.root
exports.parseTemplate = parse.parseTemplate

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

var default_object_proto = ({}).__proto__

function chain(obj, indent) {
  console.error(indent || '' + util.inspect(obj, true, null))
  if (obj.__proto__ !== null)
    chain(obj.__proto__, '+ ' + indent || '')
  // if (obj.__proto__ !== null)
}

function _replaceProto(object, old_proto, new_proto) {
  var current = object
  for (var i = 0; i < 100; i++) {
    if (current === new_proto) {
      break
    }
    else if (current.__proto__ === old_proto) {
      current.__proto__ = new_proto
      break
    }
    current = current.__proto__
  }
}

// _insertProto takes an object, @new_proto, and sort of stages that behind @object itself, such that @object's properties obscure any properties @new_proto might already have, but if @new_proto has any properties that @object doesn't have, they shine through as if they were properties of @object.
// Also, it inserts it at the very end, so that all of object's __proto__'s, if there are any, come before.
function _insertProto(object, new_proto) {
  // console.error('-----------------------------------------------')
  // chain(object)
  // chain(new_proto)
  // console.error(object, object.__proto__, object.__proto__.__proto__, object.__proto__.__proto__.__proto__)
  // console.error(new_proto, new_proto.__proto__, new_proto.__proto__.__proto__, new_proto.__proto__.__proto__.__proto__)
  // new_proto, presumably, has a bottom-level proto equivalent to `default_object_proto`
  if (object === new_proto || object.__proto__ === new_proto) {
    // in case you go through a list, which puts the global context behind each item (and leaves it there),
    // and then exit the list and go through an item, which tries to put the global context behind it again,
    // and it's already there from before. so, basically, you do nothing. It's already done, what you wanted to do.
  }
  else if (object.__proto__ === default_object_proto) {
    try {
      object.__proto__ = new_proto
    } catch(err) {
      console.error('-------------------- FAIL ----------------------')
      // console.error('1', object, '2', object.__proto__, '3', new_proto)
    }
  }
  else {
    _insertProto(object.__proto__, new_proto)
  }

}

function copyProperties(from, to) {
  for (attr in from)
    to[attr] = from[attr]
}


var Renderer = exports.Renderer = function(asap) {
  this.stream = new Stream()
  this.asap = asap
  this.context = null
  this.callback = function() {}
}
Renderer.prototype = {
  pipeTo: function(output) {
    this.stream.pipe(output)
  },
  addContext: function(name, value) {
    this.context[name] = value
    this.emit('bump')
    return this // chainable
  },
  extendContext: function(obj) {
    // if (this.context == {})
    //   this.context = obj
    // else
    copyProperties(obj, this.context)
    this.emit('bump')
    return this // chainable
  },
  force: function() {
    // use force to quit waiting for new context variables, and simply leave gaps for missing context variables, where possible
    this.asap = false
    this.emit('bump')
    return this // chainable
  },
  start: function(names, context, asap) { // aka render_global
    // if names is 1-long, it can be provided as a simple string (which we normalize to an array here)
    if (!names instanceof Array) {
      names = [names]
    }
    if (context !== undefined)
      this.extendContext(context)
    if (asap !== undefined)
      this.asap = asap
    var renderer = this
    process.nextTick(function() {
      var tokens = parse.hitCache(names[0])
      return renderer.render_tokens(tokens, names.slice(1), renderer.context, function(err) {
        if (err) throw err
        // console.log("Done! Sending end")
        renderer.stream.emit('end')
        if (renderer.callback)
          renderer.callback(err)
      })
    })
    return this
  },
  render_tokens: function(tokens, yield_names, context, callback) {
    // console.log("Rendering tokens:", util.inspect(tokens, false, null))
    var renderer = this
    var i = 0;
    (function next() {
      try {
        var token = tokens[i++]

        if (token === undefined) {
          // we're done! (with this scope)
          return callback(undefined)
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
          var partial_tokens = parse.hitCache(variable)
          return renderer.render_tokens(partial_tokens, [], context, next)
        }
        else if (command === 'yield') {
          if (yield_names[0] === undefined)
            throw new Error('Cannot yield nothing')
          var yield_tokens = parse.hitCache(yield_names[0])
          return renderer.render_tokens(yield_tokens, yield_names.slice(1), context, next)
        }
        else {
          (function bump() {
            var item = context
            var splits = variable.split('.')
            for (var i = 0, len = splits.length; i < len; i++) {
              new_item = item[splits[i]]
              if (typeof(new_item) === 'function')
                item = new_item.apply(item) // item(block) ?(block) ? allow parameters?
              else
                item = new_item

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
                function sectionRender(item, background, callback) {
                  if (typeof(item) !== 'object') {
                    // for strings, numbers, booleans, etc.
                    item = {'_': item}
                  }
                  _replaceProto(item, default_object_proto, background)
                  return renderer.render_tokens(block, [], item, function() {
                    _replaceProto(item, background, default_object_proto) // put it back
                    next()
                  })
                }
              
                if (item instanceof Array) {
                  var i = 0;
                  (function next2() {
                    var top = item[i++]
                    if (top) {
                      return sectionRender(top, context, next2)
                    }
                    return next()
                  })()
                }
                else {
                  return sectionRender(item, context, next)
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
}
util.inherits(Renderer, EventEmitter)
// Renderer.prototype = new EventEmitter
