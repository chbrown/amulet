/*jslint node: true */
var fs = require('fs');
var path = require('path');
var tap = require('tap');

var helpers = require('../lib/helpers');


function readSpecsDirectory(dirpath, callback) {
  /** readSpecsDirectory: given a directory, read all triples of mu+json+html

  `callback`: function(Error | undefined, [{name: String, mu: String, json: String, html: String}])
  */
  var lookup = {};
  fs.readdir(dirpath, function(err, filenames) {
    if (err) return callback(err);

    helpers.eachSeries(filenames, function(filename, callback) {
      var ext = path.extname(filename);
      var basename = path.basename(filename, ext);
      if (ext) { // skip .DS_Store
        var filepath = path.join(dirpath, filename);
        fs.readFile(filepath, {encoding: 'utf8'}, function(err, data) {
          if (!err) {
            lookup[basename] = lookup[basename] || {name: basename};
            lookup[basename][ext.slice(1)] = data;
          }
          callback(err);
        });
      }
      else {
        callback();
      }
    }, function(err) {
      var specs = Object.keys(lookup).map(function(key) {
        return lookup[key];
      });
      callback(err, specs);
    });
  });
}

function testSpecsDirectory(dirpath, t) {
  var amulet = require('..').create({root: dirpath});

  readSpecsDirectory(dirpath, function(err, specs) {
    t.notOk(err, 'readSpecsDirectory should not raise an error');

    helpers.eachSeries(specs, function(spec, callback) {
      var template_names = [spec.name + '.mu'];
      var context = eval('(' + spec.json + ')');
      var asap = false;
      // spec.mu has been precompiled (or at least, it should have been)
      amulet.string(template_names, context, asap, function(err, rendered) {
        t.notOk(err, spec.name + ': amulet.string() should not raise an error');
        t.ok(rendered, spec.name + ': amulet.string() should produce content');

        rendered = rendered || ''; // in case there was an error, above, don't raise an exception
        var gold = spec.html;
        if (!process.env.WHITESPACE) {
          rendered = rendered.replace(/\s+/g, '');
          gold = gold.replace(/\s+/g, '');
        }
        t.equal(rendered, gold, spec.name + ': rendered html should equal spec html.');
        callback();
      });
    }, function(err) {
      t.notOk(err, 'specs loop should not raise an error');
      t.end();
    });
  });
}

tap.test('specs: basic', function(t) {
  testSpecsDirectory('specs/basic', t);
});

tap.test('specs: extended', function(t) {
  testSpecsDirectory('specs/extended', t);
});
