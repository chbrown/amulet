var fs = require('fs'),
    yaml = require('js-yaml');
    amulet = require('../lib/rendering'),
    async = require('async'),
    argv = require('optimist').default({'ignore-whitespace': true, extended: false}).argv;

if (argv.extended) {
  String.prototype.capitalize = function() {
      return this.charAt(0).toUpperCase() + this.slice(1);
  };
  String.prototype.titleize = function() {
    var result = [];
    var parts = this.split(" ");
    for (var ii in parts) {
      result.push(capitalize(parts[ii]));
    }
    return result.join(" ");
  };
  String.prototype.humanize = function() {
    return titleize(this.replace(/_/g, ' '));
  };
  String.prototype.equals = function(test) {
    return this.valueOf() === test;
  };
}

var successes = 0, failures = 0;

function runTest(test, callback) {
  var context = {};
  process.stdout.write('  Spec: ' + test.description + ' ');
  amulet.parseTemplate(test.description, test.template);

  try {
    context = eval('(' + test.context + ')');
  }
  catch (e) {
    console.error('Reading context failed', e, test.context);
  }

  amulet.renderString(test.description, context, function(err, output) {
    var matches = output == test.output;
    if (argv['ignore-whitespace'] && !matches)
      matches = output.replace(/\s+/g, '') == test.output.replace(/\s+/g, '');

    if (matches) {
      successes++;
      process.stdout.write('[Success]\n');
    }
    else {
      failures++;
      process.stdout.write('[Failed]\n  Expected:\n' + test.output + '\n  Actual:\n' + output + '\n');
    }

    callback(err);
  });
}

// runSpec('extended_spec.yaml');
var full_spec = yaml.load(fs.readFileSync('local_spec.yaml', 'utf8'));
var tests = full_spec.tests;
if (argv.extended) {
  tests.push.apply(tests, full_spec.extended_tests);
}
async.forEachSeries(tests, runTest, function(callback) {
  var success_rate = successes / (successes + failures);
  console.log((success_rate * 100 | 0) + '% success');
});
