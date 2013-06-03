'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var yaml = require('js-yaml');
var amulet = require('../lib/rendering');
var test = require('tap').test;

function extendString() {
  String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  };
  String.prototype.titleize = function() {
    var result = [];
    var parts = this.split(' ');
    for (var ii in parts) {
      result.push(parts[ii].capitalize());
    }
    return result.join(' ');
  };
  String.prototype.humanize = function() {
    return this.replace(/_/g, ' ').titleize();
  };
  String.prototype.equals = function(test) {
    return this.valueOf() === test;
  };
}

function testSpec(t, spec) {
  // console.error(spec.description);
  // parse template into the saved template name that is the description, e.g. 'boolean'
  amulet.parseTemplate(spec.description, spec.template);

  var context = eval('(' + spec.context + ')');
  var expected = spec.output;
  // render with that same name, too.
  amulet.renderString(spec.description, context, function(err, output) {
    // have to read the whitespace arg from the environment, not from the command line
    if (process.env.WHITESPACE && !process.env.WHITESPACE.match(/false/i)) {
      console.error('Ignoring whitespace.');
      output = output.replace(/\s+/g, '');
      expected = expected.replace(/\s+/g, '');
    }
    t.equal(output, expected, 'Found == wanted.');
  });
}

extendString();
fs.readFile('local_spec.yaml', 'utf8', function(err, file_contents) {
  var specs = yaml.load(file_contents);

  // console.error('specs', specs);
  test('basic tests', function(t) {
    t.plan(specs.basic.length);
    specs.basic.forEach(function(spec) {
      t.test(spec.description, function(t) {
        t.plan(1);
        testSpec(t, spec);
      });
    });
  });

  test('extended tests', function(t) {
    t.plan(specs.extended.length);
    specs.extended.forEach(function(spec) {
      t.test(spec.description, function(t) {
        t.plan(1);
        testSpec(t, spec);
      });
    });
  });
});
