var rendering = require('./rendering');
exports.root = rendering.root; // a function
exports.settings = rendering.settings; // a function
exports.parseTemplate = rendering.parseTemplate;

// todo:
//   implement ability to add names asap-ly, so that the first one can start rendering without its yield being specified yet

// names can be either a string or an array of strings
exports.render = function(names, context, output, callback) {
  // callback signature: function(err)
  var renderer = new rendering.StreamRenderer(false); // asap=false
  renderer.context = context;
  if (callback) {
    renderer.callback = callback;
  }
  if (output) {
    renderer.stream.pipe(output);
  }
  renderer.start(names);
  return renderer;
};

exports.init = function(output) {
  var renderer = new rendering.StreamRenderer(true); // asap=true
  if (output) {
    renderer.stream.pipe(output);
  }
  return renderer;
};

exports.renderString = function(names, context, callback) {
  // callback signature: function(err, string)
  // can I force it to be sync? callback is okay too, if not
  var renderer = new rendering.StringRenderer(callback);
  renderer.context = context;
  renderer.start(names);
  return renderer;
};
