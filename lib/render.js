var parsing = require('./parsing'),
    rendering = require('./rendering');

exports.set = parsing.set; // a function
exports.parseTemplate = parsing.parseTemplate;

// todo:
//   implement ability to add templates asap-ly, so that the first one can start rendering without its yield being specified yet

exports.render = function(output, templates /*, context, asap, callback*/) {
  // @output: a stream
  // @templates: an array of strings (coerces naked string to 1-array)
  // @context: a string or an array of strings
  // @callback: function(err) { }
  // @asap: boolean that determines how to handle missing variables.
  var args = Array.prototype.slice.call(arguments),
      // pop from the right
      callback = typeof(args[args.length - 1]) === 'function' ? args.pop() : function() {},
      asap = typeof(args[args.length - 1]) === 'boolean' ? args.pop() : false,
      context = args.length > 2 ? args.pop() : {};
  var renderer = new rendering.StreamRenderer(context, asap, callback);
  renderer.stream.pipe(output);
  if (templates)
    renderer.start(templates);
  return renderer;
};

exports.renderString = function(names, context, callback) {
  // callback signature: function(err, string)
  // can I force it to be sync? callback is okay too, if not
  var renderer = new rendering.StringRenderer(context, false, callback);
  renderer.start(names);
  return renderer;
};
