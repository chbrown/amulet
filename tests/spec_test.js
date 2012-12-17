var fs = require('fs'),
    yaml = require('js-yaml');
    amulet = require('../lib/rendering'),
    argv = require('optimist').default({'ignore-whitespace': false}).argv;

function testSpec(yaml_filepath) {
  var tests = yaml.load(fs.readFileSync(yaml_filepath, 'utf8')).tests;
  var successes = 0, total = tests.length;
  (function next() {
    var spec = tests.shift(), context;
    if (spec) {
      process.stdout.write('  Spec: ' + spec.description + ' ');
      amulet.parseTemplate(spec.description, spec.template);

      try {
        context = eval('(' + spec.context + ')');
      }
      catch (e) {
        console.error('Reading context failed', e, spec.context);
      }

      amulet.renderString(spec.description, context, function(err, output) {
        var matches = output == spec.output;
        if (argv['ignore-whitespace'] && !matches)
          matches = output.replace(/\s+/g, '') == spec.output.replace(/\s+/g, '');

        if (matches) {
          successes++;
          process.stdout.write('[Success]\n');
        }
        else {
          process.stdout.write('[Failed]\n  Expected:\n' + spec.output + '\n  Actual:\n' + output + '\n');
        }

        next();
      });
    }
    else {
      console.log('Done. ' + parseInt((successes / total) * 100, 10) + '% success rate.');
    }
  })();
}

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
  testSpec('extended_spec.yaml');
}
else {
  testSpec('local_spec.yaml');
}
