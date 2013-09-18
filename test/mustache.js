'use strict'; /*jslint es5: true, node: true, indent: 2 */
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var tap = require('tap');

var helpers = require('../lib/helpers');


function runSpec(spec, t, callback) {
  var amulet = require('..').create();

  helpers.eachSeries(spec.tests, function(test, callback) {
    Object.keys(test.partials || {}).forEach(function(partial_name) {
      var partial_value = test.partials[partial_name];
      amulet.cache.templates[partial_name] = amulet.cache.parser.parse(partial_value);
    });

    var context = test.data;
    if (context.lambda) {
      context.lambda = eval('(' + context.lambda.js + ')');
    }
    var asap = false;

    amulet.cache.templates[test.name] = amulet.cache.parser.parse(test.template);

    amulet.string([test.name], context, asap, function(err, rendered) {
      if (err) throw err;
      // t.notOk(err, test.name + ': amulet.string() should not raise an error');
      // t.ok(rendered, test.name + ': amulet.string() should produce content');

      rendered = rendered || ''; // in case there was an error, above, don't raise an exception
      var gold = test.expected;
      if (!process.env.WHITESPACE) {
        rendered = rendered.replace(/\s+/g, '');
        gold = gold.replace(/\s+/g, '');
      }
      t.equal(rendered, gold, test.name + ': rendered html should equal expected html (' + test.desc + ')');
      callback();
    });

  }, callback);
}

tap.test('mustache specs', function(t) {
  // ./mustache-spec is a submodule cloned from https://github.com/mustache/spec.git
  var specs_directory = path.join(__dirname, 'mustache-spec', 'specs');
  fs.readdir(specs_directory, function(err, filenames) {
    t.notOk(err, 'fs.readdir should not raise an error');
    helpers.eachSeries(filenames, function(filename, callback) {
      // skip non-json files
      if (filename.match(/^[^~]+json$/)) {
        var filepath = path.join(specs_directory, filename);
        fs.readFile(filepath, {encoding: 'utf8'}, function(err, data) {
          t.notOk(err, 'fs.readFile("' + filepath + '") should not raise an error');
          var spec = JSON.parse(data);
          runSpec(spec, t, callback);
        });
      }
      else {
        callback();
      }
    }, function(err) {
      t.notOk(err, 'file read loop should not raise an error');
      t.end();
    });
  });
});

tap.test('mustache repository', function(t) {
  var mustache_repository = path.join(__dirname, 'mustache-spec');
  fs.exists(mustache_repository, function(exists) {
    t.ok(exists, 'mustache repository should exist: ' + mustache_repository);
    t.end();
  });
});
