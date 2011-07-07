var render = require('./mu/render')
exports.root = render.root // a function
exports.parseTemplate = render.parseTemplate

// todo:
//   implemented ability to add names asap-ly, so that the first one can start rendering without its yield being specified yet

// names can be either a string or an array of strings
exports.render = function(names, context, pipe_to, callback) {
  var renderer = new render.Renderer(context, pipe_to, false, callback)
  renderer.start(names)
  return renderer
}

exports.init = function(context, pipe_to, callback) {
  return new render.Renderer(context, pipe_to, true, callback);
}