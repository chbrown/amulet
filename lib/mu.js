var renderer = require('./mu/renderer')
exports.root = renderer.root // a function
exports.parseTemplate = renderer.parseTemplate

exports.render = function(names, context, pipe_to, asap, callback) {
  // if names is 1-long, it can be provided as a simple string (which we normalize to an array here)
  if (!names instanceof Array) {
    names = [names]
  }
  if (asap && asap.call) {
    callback = asap
    asap = false
  }

  // this shouldn't take any time at all, really.
  var mu_renderer = new renderer.Renderer(context, pipe_to, asap)
  
  process.nextTick(function () {
    try {
      // names get thrown in here, because they take longer
      mu_renderer.render_global(names, callback)
    } catch (err) {
      mu_renderer.stream.emit('error', err)
      if (callback)
        callback(err)
    }
  })
    
  return mu_renderer
}
