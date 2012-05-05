var fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    amulet = require('../lib/main'),
    argv = require('optimist').argv;

var ignore_whitespace = argv['ignore-whitespace'] === undefined ? false : argv['ignore-whitespace'];

function RenderError(spec, test, output) {
  this.spec = spec;
  this.test = test;
  this.output = output;
}
RenderError.prototype.toString = function() {
  return [
    'Test:', this.test.name,
    'Description:', this.test.desc,
    'Expected:', this.test.expected,
    'Actual:', this.output].join('\n');
  // console.log('    expected: ^' + test.expected.replace(/\n/g, '¬\n') + '$');
  // console.log('    rendered: ^' + rendered.replace(/\n/g, '¬\n') + '$');
};

var errors = [];

function testSpec(spec, callback) {
  // console.log('[' + spec.name + '] ' + spec.overview);

  (function next() {
    var test = spec.tests.shift();
    if (!test) {
      // console.log("\n  Done with this spec's tests");
      return callback();
    }
    else {

      amulet.parseTemplate(test.name, test.template);

      for (var partial_name in test.partials) {
        var partial_value = test.partials[partial_name];
        amulet.parseTemplate(partial_name, partial_value);
      }

      var data = test.data;
      if (data.lambda) {
        data.lambda = eval('(' + data.lambda.js + ')');
      }

      // console.log('[' + test.name + ']');
      amulet.renderString(test.name, data, function(err, output) {
        var matches = output == test.expected;
        if (ignore_whitespace && !matches)
          matches = output.replace(/\s+/g, '') == test.expected.replace(/\s+/g, '');

        if (matches) {
          process.stdout.write('.');
        }
        else {
          process.stdout.write('E');
          errors.push(new RenderError(spec, test, output));
        }

        next();
      });
    }
  })();

  return callback();
}

function test() {
  var specs_dir = path.join(__dirname, 'mustache', 'specs');
      specs_files = fs.readdirSync(specs_dir);

  (function next() {
    var spec_file = specs_files.shift();
    if (spec_file) {
      if (spec_file.match(/json$/)) {
        var spec_contents = fs.readFileSync(path.join(specs_dir, spec_file));
        var spec = JSON.parse(spec_contents);
        testSpec(spec, next);
      }
    }
    else {
      console.log("Done with all tests.");
      if (errors.length) {
        console.log("Errors:\n");
        errors.forEach(function(error) {
          console.log(error.toString());
        });
      }
    }
  })();
}

if (path.existsSync(path.join(__dirname, 'mustache', 'specs', '.git'))) {
  console.log("Updating spec repo with git pull");
  exec('git pull', { cwd: spec_repo_path, env: process.env }, test);
}
else {
  console.log("Pulling down the spec repo with git clone");
  exec('git clone git://github.com/mustache/spec.git mustache', { cwd: __dirname, env: process.env }, test);
}

