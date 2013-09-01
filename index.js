'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var Renderer = require('./lib/renderer');
var util = require('util');
var events = require('events');

var Cache = require('./lib/cache');

var Manager = module.exports = function(lookup, parser) {
  events.EventEmitter.call(this);
  this.cache = new Cache(lookup, parser);
};
util.inherits(Manager, events.EventEmitter);

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
  var helpers = require('./lib/helpers');
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
    // if (err) console.error('lookup error', err); // just ignore precompilation errors
    helpers.eachSeries(filenames, function(filename, callback) {
      manager.cache.get(filename, callback);
    }, function(err) {
      if (err) {
        // console.error('manager lookup / precompilation error', err);
        manager.emit('error', err);
      }
      else {
        manager.emit('precompiled');
      }

      if (callback) {
        callback(err, manager);
      }
    });
  });

  return manager;
};

// Manager will also serve as a interface to the singleton manager, with certain defaults.
var singleton = Manager.create(); // create manager with all defaults.
Manager.stream = singleton.stream.bind(singleton);
Manager.string = singleton.string.bind(singleton);
