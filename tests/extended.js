var fs = require('fs'),
    path = require('path'),
    amulet = require('../lib/amulet'),
    Stream = require('stream').Stream,
    Buffer = require('buffer').Buffer,
    yaml2json = require('./lib').yaml2json;

var ignore_whitespace = true;
console.log('ignore_whitespace = ' + ignore_whitespace);

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

yaml2json('extended_spec.yaml', 'extended_spec.json', function() {
  var tests = JSON.parse(fs.readFileSync('extended_spec.json')).tests;
  var i = 0;
  (function next() {
    if (i < tests.length) {
      var spec = tests[i++], context;
      process.stdout.write('  Spec: ' + spec.description + ' ');
      amulet.parseTemplate(spec.description, spec.template);
      try {
        context = eval('(' + spec.context + ')');
      }
      catch (e) {
        console.error('Reading context failed', e, spec.context);
      }

      amulet.renderString(spec.description, context, function(err, output) {
        if (
            output == spec.output || 
            (ignore_whitespace && output.replace(/\s+/g, '') == spec.output.replace(/\s+/g, ''))
           ) {
          process.stdout.write('[Success]\n');
        } 
        else {
          process.stdout.write('[Failed]\n  Expected:\n' + spec.output + '\n  Actual:\n' + output + '\n');
        }

        next();
      });
    }
    else {
      console.log('Done.');
    }
  })();
});
