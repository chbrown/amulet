'use strict'; /*jslint es5: true, node: true, indent: 2 */

exports.extend = function(destination /*, sources*/) {
  /** `extend(...)`: just like _.extend(destination, *sources), copy all values
  from each source into destination, overwriting with latter values.

  `destination`: {...} | null.
  */
  destination = destination || {};
  [].slice.call(arguments, 1).forEach(function(source) {
    for (var prop in source) {
      destination[prop] = source[prop];
    }
  });
  return destination;
};

exports.eachSeries = function(arr, iterator, callback) {
  /** `eachSeries(...)`: just like async.eachSeries, for each item in a list,
  run it through a function and when they all finish, call the callback

  `iterator`: function(item, next)
      `next`: function(err)

  `callback`: function(err)
  */
  var i = 0;
  var l = arr.length;
  (function next(err) {
    if (!err && i < l) {
      iterator(arr[i++], next);
    }
    else {
      callback(err);
    }
  })();
};

exports.escapeHtmlString = function(string) {
  return string.replace(/[&<>"]/g, function(string) {
    switch (string) {
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '&':
      return '&amp;';
    case '"':
      return '&quot;';
    default:
      return string;
    }
  });
};

exports.escapeHtmlBuffer = function(raw_buffer) {
  /** escapeHtmlBuffer(...): escape all instances of `"`, `&`, `'`, `<`, or `>`,  in a buffer.

  `raw_buffer`: Buffer of (potentially) unescaped data.

  returns a fully escaped Buffer
  */
  var raw_length = raw_buffer.length;
  // first pass: go through and record the locations of all the bytes we need to escape
  var escapes = [];
  // escapes_indices.length will always equal escapes.length
  var escapes_indices = [];
  // added_length is just the additional length we need for the
  // escaped buffer. Should be equivalent to `escapes.join('').length - escapes.length`
  // I.e., for each escape string, += `escape.length - 1`, since we already
  // have space for one character in the buffer (with the raw character)
  var added_length = 0;
  for (var i1 = 0; i1 < raw_length; i1++) {
    switch (raw_buffer[i1]) {
    case 34: // "
      escapes_indices.push(i1);
      escapes.push('&quot;');
      added_length += 5;
      break;
    case 38: // &
      escapes_indices.push(i1);
      escapes.push('&amp;');
      added_length += 4;
      break;
    case 39: // '
      escapes_indices.push(i1);
      escapes.push('&apos;');
      added_length += 5;
      break;
    case 60: // <
      escapes_indices.push(i1);
      escapes.push('&lt;');
      added_length += 3;
      break;
    case 62: // >
      escapes_indices.push(i1);
      escapes.push('&gt;');
      added_length += 3;
      break;
    }
  }

  // initialize destination buffer, now that we know how long it should be
  var escaped_buffer = new Buffer(raw_length + added_length);
  var escaped_buffer_offset = 0;

  // second pass: copy into the destination buffer piecewise
  var last_escape_index = -1;
  var escapes_count = escapes.length;
  for (var i2 = 0; i2 < escapes_count; i2++) {
    var escape = escapes[i2];
    var escape_index = escapes_indices[i2];

    // buf.copy(targetBuffer, [targetStart], [sourceStart], [sourceEnd])
    raw_buffer.copy(escaped_buffer, escaped_buffer_offset, last_escape_index + 1, escape_index);
    escaped_buffer_offset += escape_index - last_escape_index;
    escaped_buffer.write(escape,  'ascii');
    escaped_buffer_offset += escape.length;

    last_escape_index = escape_index;
  }

  // copy whatever might be left following the last escape in the raw_buffer
  // note that if escapes_count == 0, this will run with sourceStart = 0, as we want it to
  raw_buffer.copy(escaped_buffer, escaped_buffer_offset, last_escape_index + 1);

  return escaped_buffer;
};

var base_proto = ({}).__proto__; // base_proto.__proto__ === null

exports.protoPush = function(object, new_proto) {
  // measure how deep the object goes if it doesn't have a __depth indicator
  if (!object.__depth) {
    var current = object.__proto__;
    for (var i = 0; i < 8; i++) {
      if (current === base_proto) {
        object.__depth = i;
        break;
      }
      current = current.__proto__;
    }
  }
  // don't store the object(.__proto__)+ that gets replaced, since we're assuming it === base_proto
  switch (object.__depth) {
    case 0: object.__proto__ = new_proto; break;
    case 1: object.__proto__.__proto__ = new_proto; break;
    case 2: object.__proto__.__proto__.__proto__ = new_proto; break;
    case 3: object.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 4: object.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 5: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 6: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    case 7: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = new_proto; break;
    default: console.error("protoPush doesn't handle protos that deep. Sry!"); break;
  }
  object.__depth++;
};

exports.protoPop = function(object) {
  switch (object.__depth) {
    case 0: console.error("Cannot popProto an object with __depth == 0"); break;
    case 1: object.__proto__ = base_proto; break;
    case 2: object.__proto__.__proto__ = base_proto; break;
    case 3: object.__proto__.__proto__.__proto__ = base_proto; break;
    case 4: object.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 5: object.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 6: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 7: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    case 8: object.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__.__proto__ = base_proto; break;
    default: console.log("protoPop doesn't handle protos that deep."); break;
  }
  object.__depth--;
};

var globals = {
  'JSON': JSON,
  'Number': Number,
  'Object': Object
};
var dottedEval = exports.dottedEval = function(context, expression) {
  // handles strings that occur in context or dotted paths that traverse a context object
  // the leftmost entry in evaluations is the end result of the dotted evaluation
  var evaluations;
  if (expression == '.') {
    // for those embedded sections (silly Mustache spec, should be _)
    evaluations = [context['.'], context];
  }
  else {
    var parts = expression.split('.');
    var length = parts.length;
    evaluations = new Array(length + 1);
    evaluations[length] = context;
    for (var i = 0; i < length; i++) {
      var part = parts[i];
      var subcontext = evaluations[length - i];
      var value = (subcontext !== undefined && subcontext !== null) ? subcontext[part] : null;
      if (value === null || value === undefined) {
        if (globals[part] !== undefined) {
          value = globals[part];
        }
      }
      // we work from right to left in evaluations[], as we evaluate the expression from left to right
      evaluations[length - i - 1] = value;
    }
  }
  return evaluations;
};
exports.flexibleEval = function(context, expression) {
  /** flexibleEval: return a value represented by the given expression,
  which may be a literal number or string, or a dotted path to be evaluated
  within the given context.

  Returns a single value, unlike dottedEval, which always returns a full
  dotted evaluation sequence.
  */
  var trimmed_expression = expression.replace(/^\s+|\s+$/g, '');
  if (trimmed_expression.match(/^('|").*\1$/)) {
    // string literal
    return trimmed_expression.slice(1, -1);
  }
  else if (trimmed_expression.match(/^-?\d+$/)) {
    // integer literal
    return parseInt(trimmed_expression, 10);
  }
  else if (trimmed_expression.match(/^-?(\d*\.\d+|\d+\.\d*)$/)) {
    // floating point literal
    return parseFloat(trimmed_expression);
  }
  return dottedEval(context, trimmed_expression)[0];
};
