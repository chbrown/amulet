var parsing = require('./parsing'),
    rendering = require('./rendering');

exports.set = parsing.set; // a function
exports.parseTemplate = parsing.parseTemplate;

// todo:
//   implement ability to add names asap-ly, so that the first one can start rendering without its yield being specified yet

exports.render = function(output, names, context, callback) {
  // @output: a string
  // @names: an array of strings (coerces naked string to 1-array)
  // @context: a string or an array of strings
  // @callback: function(err) { }
  var asap = names && context && callback;
  if (callback === undefined) callback = function() {};
  var renderer = new rendering.StreamRenderer(asap, callback, context || {});
  renderer.stream.pipe(output);
  if (names)
    renderer.start(names);
  return renderer;
};

exports.renderString = function(names, context, callback) {
  // callback signature: function(err, string)
  // can I force it to be sync? callback is okay too, if not
  var renderer = new rendering.StringRenderer(false, callback, context);
  renderer.start(names);
  return renderer;
};
