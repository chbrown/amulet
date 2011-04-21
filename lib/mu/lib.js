//
// Used to escape RegExp strings
//
exports.escapeRegex = function(text) {
  // thank you Simon Willison
  if(!arguments.callee.sRE) {
    var specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  
  return text.replace(arguments.callee.sRE, '\\$1');
}

exports.to_s = function(val) {
  return typeof val === 'undefined' ? '' : val.toString();
}

function escapeReplace(char) {
  switch (char) {
    case '<': return '&lt;'
    case '>': return '&gt;'
    case '&': return '&amp;'
    case '"': return '&quot;'
    default: return char;
  }
}

exports.escape = function(unescaped) {
  return unescaped.replace(/[&<>"]/g, escapeReplace);
}

exports.resolve = function(context, name, arguments) {
  var val = context[name];
  
  if (typeof(val) === 'function') {
    val = context[name](arguments);
  }
  
  return val;
}
