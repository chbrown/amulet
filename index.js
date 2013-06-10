'use strict'; /*jslint node: true, es5: true, indent: 2 */
var Renderer = require('./renderer');
var TemplateLookup = require('./lookup');

var lookup = new TemplateLookup();

exports.set = function(settings) {
  // e.g., settings = {minify: true, root: 'templates'}
  for (var key in settings) {
    lookup[key] = settings[key];
  }
  lookup.precompile();
};

exports.stream = function(templates, context, asap) {
  // if (asap == true) that means we wait when needed.
  return new Renderer(templates, context, asap, lookup);
};
