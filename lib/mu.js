var render = require('./mu/render')
exports.root = render.root // a function
exports.parseTemplate = render.parseTemplate

// todo:
//   implemented ability to add names asap-ly, so that the first one can start rendering without its yield being specified yet

// names can be either a string or an array of strings
exports.render = function(names, context, output, callback) {
  var renderer = new render.Renderer(false)
  renderer.context = context
  if (callback)
    renderer.callback = callback
  if (output)
    renderer.pipeTo(output)
  renderer.start(names)
  return renderer
}

exports.init = function(output) {
  var renderer = new render.Renderer(true);
  if (output)
    renderer.pipeTo(output);
  return renderer;
}