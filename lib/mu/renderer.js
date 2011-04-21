// var parser = require('./parser')
var util = require('util')
var lib = require('./lib'),
    escape = lib.escape,
    resolve = lib.resolve,
    to_s = lib.to_s
    
var baseProto = ({}).__proto__

/**
 * Renders the previously parsed filename or the parsed object.
 *
 * @param {Array} names The filenames (cache keys) of the cached templates to use, arranged from grandparents to children.
 * @param {Object} context The data to use when rendering.
 * @param {Object} cache The cache from which to retrieve partials/layouts.
 * @param {Stream} stream The stream to output everything to.
 * @param {Function} callback What to call when we're done.
 *
 * @returns {Nothing} But that's okay because it's triggered in a process.nextTick.
 * @throws {Error(template_not_in_cache)} If filename was not found in cache.
 */
var render = exports.render = function(tokens, yield_into, context, cache, stream, callback) {
  // console.log('Rendering tokens:')
  // console.log(util.inspect(tokens, false, null)) 

  if (tokens[0] !== 'multi') {
    throw new Error('Mu - WTF did you give me? I expected mustache tokens.');
  }
  
  var i = 1;
  
  (function next() {
    try {
    
      if (stream.paused) {
        stream.on('drain', function () {
          process.nextTick(next);
        });
        return;
      }
    
      var token = tokens[i++];
    
      if (!token) {
        return callback ? callback() : true;
      }
      
      // token = [<static/mustache>, <tag>, <content>]
      if (token[0] === 'static') {
        stream.emit('data', token[2]);
        return next();
      }
      else { // 'mustache'
        var tag = token[1]
        var content = token[2]
        if (tag === 'utag' || tag === 'etag') {
          var out =  to_s(resolve(context, content)) // Unescaped Tag
          if (tag === 'etag')
            out = escape(out) // Escaped Tag
          stream.emit('data', out)
          return next()
        }
        else if (tag === 'section' || tag === 'inverted_section') {
          var res = resolve(context, content, token[3]);
          if (tag === 'inverted_section')
            res = !res
          if (res)
            return section(context, content, res, token[4], cache, stream, next)
          else
            return next()
        }
        else if (tag === 'partial') {
          var cached_template = cache.hitSync(content)
          if (cached_template)
            // partials cannot have inheritance!
            return render(cached_template, [], context, cache, stream, next)
          else {
            console.log('Ignoring cache miss: ' + content);
            return next()
          }
        }
        else if (tag === 'yield') {
          var name_0 = yield_into[0]
          if (name_0 === undefined)
            throw new Error('Cannot yield nothing')
          var cached_template = cache.hitSync(name_0)
          if (cached_template)
            return render(cached_template, yield_into.slice(1), context, cache, stream, next)
          else {
            console.log('Ignoring cache miss: ' + content);
            return next()
          }
        }
      }
    } catch (err) {
      stream.emit('error', err);
      next()
    }
  }())
}

function section(view, name, val, tokens, cache, stream, callback) {
  // var val = resolve(view, name, body);
  
  // if (typeof val === 'boolean') {
  //   return val ? render(tokens, view, cache, stream, callback) : callback();
  // }
  
  if (val instanceof Array) {
    var i = 0;
    
    (function next() {
      var item = val[i++];
      
      if (item) {
        //view.push(item);
        var proto = insertProto(item, view);
        render(tokens, [], item, cache, stream, function () {
          proto.__proto__ = baseProto;
          next();
        });
        //view.pop();
      } else {
        callback();
      }
      
    }());
    
    return;
  }
  
  if (typeof val === 'object') {
    //view.push(val);
    var proto = insertProto(val, view);
    render(tokens, [], val, cache, stream, callback);
    proto.__proto__ = baseProto;
    //view.pop();
    return;
  }
  
  if (val) {
    return render(tokens, [], view, cache, stream, callback);
  }
  
  return callback();
}


//
//
//
// function findInContext(context, key) {
//   var i = context.length;
//   while (i--) {
//     if (context[i][key]) {
//       return context[i][key];
//     }
//   }
// 
//   return undefined;
// }


function insertProto(obj, newProto, replaceProto) {
  replaceProto = replaceProto || baseProto;
  var proto = obj.__proto__;
  while (proto !== replaceProto) {
    obj = proto;
    proto = proto.__proto__;
  }
  obj.__proto__ = newProto;
  return obj;
}

