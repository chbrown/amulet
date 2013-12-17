'use strict'; /*jslint es5: true, node: true, indent: 2 */
var helpers = require('./lib/helpers');
var Cache = require('./lib/cache');
var Renderer = require('./lib/renderer');

var Manager = module.exports = function(lookup, parser, globals) {
  /** Manager: the main interface to amulet rendering.

  - Creates readable streams
  - Given a lookup and parser in the constuctor, handles fetching, parsing, and caching filenames
  */
  this.cache = new Cache(lookup, parser);
  this.globals = globals;
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
  var renderer = new Renderer(template_names, this.cache, context, this.globals, asap);
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
      `globals`: Object
          context that is available to all templates at any time
          (default: {JSON: JSON, Number: Number, Object: Object})
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
    globals: {
      'JSON': JSON,
      'Number': Number,
      'Object': Object,
    },
    minify: false,
    open: '{{',
    close: '}}',
  }, options);

  var lookup = new FilesystemLookup(options.root);
  var parser = new StringParser(options);
  var manager = new Manager(lookup, parser, options.globals);

  // precompile templates asynchronously
  lookup.find(function(err, filenames) {
    manager.warmup(filenames, callback);
  });

  return manager;
};

// Manager will also serve as a interface to the singleton manager, with certain defaults.
Manager.set = function(options) {
  /** set: Creates a singleton instance and attaches it to the main export, Manager.

  Also attaches .stream() and .string() to the main export as helpers, e.g.:

      var amulet = require('amulet');
      // amulet.set({root: '/www/shared/templates'}); // <-- optional
      ...
        amulet.stream(['index.mu'], {user_id: '7009'}).pipe(res);

  Equivalent to the following, for this module (but not for others):

      amulet = require('amulet').create({root: '/path/to/templates'});
      ...

  */
  var manager = Manager.singleton = Manager.create(options);
  Manager.stream = manager.stream.bind(manager);
  Manager.string = manager.string.bind(manager);
  return manager;
};

// initialize (create) singleton manager with the default options
Manager.set();
