var parsing = require('./parsing'),
    rendering = require('./rendering');

exports.set = parsing.set; // a function
exports.parseTemplate = parsing.parseTemplate;

// todo:
//   implement ability to add templates asap-ly, so that the first one can start rendering without its yield being specified yet

exports.render = function(output, args) {
  // @output: a stream
  // @args.templates: an array of strings (coerces naked string to 1-array)
  // @args.context: a string or an array of strings
  // @args.callback: function(err) { }
  // @args.asap: boolean that determines how to handle missing variables.
  if (args === undefined) args = {};
  if (args.asap === undefined) args.asap = !(args.templates && args.context);
  if (args.context === undefined) args.context = {};
  if (args.callback === undefined) args.callback = function() {};
  var renderer = new rendering.StreamRenderer(args.asap, args.callback, args.context);
  renderer.stream.pipe(output);
  if (args.templates)
    renderer.start(args.templates);
  return renderer;
};

exports.renderString = function(names, context, callback) {
  // callback signature: function(err, string)
  // can I force it to be sync? callback is okay too, if not
  var renderer = new rendering.StringRenderer(false, callback, context);
  renderer.start(names);
  return renderer;
};
