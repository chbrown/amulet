'use strict'; /*jslint es5: true, node: true, indent: 2 */
var helpers = require('./lib/helpers');
var Cache = require('./lib/cache');
var Renderer = require('./lib/renderer');

var Manager = module.exports = function(lookup, parser) {
  /** Manager: the main interface to amulet rendering.

  - Creates readable streams
  - Given a lookup and parser in the constuctor, handles fetching, parsing, and caching filenames
  */
  this.cache = new Cache(lookup, parser);
};

Manager.prototype.stream = function(template_names, context, asap) {
  /** `stream`: take a list of templates and render them into a
  readable stream, interpolating the templates with values from context.

  `template_names`: [String]
      List of templates that TemplateLookup will use
  `context`: Object
      Dictionary to use when interpolating the templates
  `asap`: Boolean
      `asap == true` means we wait when the template requests a variable that
      is not yet available in the context. Defaults to false.
  */
  var renderer = new Renderer(template_names, this.cache, context, asap);
  renderer.start();
  return renderer;
};

Manager.prototype.string = function(template_names, context, asap, callback) {
  /** `string`: simply reads-to-end from the stream version.

  `callback`: function(Error | undefined, String | undefined)
  */
  var chunks = [];
  this.stream(template_names, context, asap)
  .on('error', function(err) {
    callback(err);
  })
  .on('data', function(chunk) {
    chunks.push(chunk);
  })
  .on('end', function() {
    callback(undefined, chunks.join(''));
  });
};

Manager.prototype.warmup = function(filenames, callback) {
  /** warmup: hit the cache for all of the provided filenames, in series

  `filenames`: [String]
  `callback`: function(Error | null, Manager | null)
  */
  var self = this;
  helpers.eachSeries(filenames, function(filename, next) {
    self.cache.get(filename, next);
  }, function(err) {
    if (callback) {
      callback(err, self);
    }
  });
};

Manager.create = function(options, callback) {
  /** `create`: create a new manager from options. Uses the default
  string parser and filesystem lookup types.

  `options`: Object
      `root`: String
          template names are relative to this directory (default: 'templates')
      `minify`: Boolean
          minify resulting html where possible (default: false)
      `open`: String
          string that designates the beginning of a expression (default: '{{')
      `close`: String
          string that designates the end of a expression (default: '}}')

  `callback`: function(Error | undefined, Manager) | undefined
      function to call when finished creating, i.e., precompiling (optional).
      `options` is not optional if `callback` is specified.
  */
  var FilesystemLookup = require('./lib/lookups/filesystem');
  var StringParser = require('./lib/parsers/string');

  options = helpers.extend({}, {
    root: 'templates',
    minify: false,
    open: '{{',
    close: '}}',
  }, options);

  var lookup = new FilesystemLookup(options.root);
  var parser = new StringParser(options);
  var manager = new Manager(lookup, parser);

  // precompile templates asynchronously
  lookup.find(function(err, filenames) {
    manager.warmup(filenames, callback);
  });

  return manager;
};

// Manager will also serve as a interface to the singleton manager, with certain defaults.
Manager.set = function(options) {
  /** set: allow setting options on the singleton, by replacing it with a new
  manager. simply runs `create` with the given options (maybe none), and uses that.
  */
  var manager = Manager.create(options);
  // create a singleton, and then attach it to the exported object, Manager
  ['stream', 'string', 'warmup'].forEach(function(property) {
    Manager[property] = manager[property].bind(manager);
  });
  return manager;
};
// create singleton manager with only the defaults
Manager.set();