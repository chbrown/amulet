var fs = require('fs'),
    amulet = require('../lib/amulet'),
    yaml2json = require('./lib').yaml2json,
    ignore_whitespace = false;

function test_yaml_spec(yaml_filepath) {
  var json_filepath = yaml_filepath.replace(/\.yaml$/, '.json');
  yaml2json(yaml_filepath, json_filepath, function() {
    var tests = JSON.parse(fs.readFileSync(json_filepath)).tests;
    var successes = 0;
    (function next(index) {
      var spec = tests[index], context;
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
          if (ignore_whitespace)
            matches = matches || (output.replace(/\s+/g, '') == spec.output.replace(/\s+/g, ''));
          
          if (matches) {
            successes++;
            process.stdout.write('[Success]\n'); 
          }
          else {
            process.stdout.write('[Failed]\n  Expected:\n' + spec.output + '\n  Actual:\n' + output + '\n');
          }
          
          next(index + 1);
        });
      }
      else {
        console.log('Done. ' + parseInt((successes / index) * 100) + '% success rate.');
      }
    })(0);
  });
}

if (process.argv.indexOf('--ignore') > -1 || process.argv.indexOf('--ignore-whitespace') > -1) {
  ignore_whitespace = true;
}

if (process.argv.indexOf('--extended') > -1) {
  String.prototype.capitalize = function() {
      return this.charAt(0).toUpperCase() + this.slice(1);
  };
  String.prototype.titleize = function() {
    var result = [];
    var parts = this.split(" ");
    for (i in parts) {
      result.push(capitalize(parts[i]));
    }
    return result.join(" ");
  };
  String.prototype.humanize = function() {
    return titleize(this.replace('_', ' '));
  };
  String.prototype.equals = function(test) {
    return this.valueOf() === test;
  };

  test_yaml_spec('extended_spec.yaml')
}
else {
  test_yaml_spec('local_spec.yaml')
}

