var fs = require('fs'),
    path = require('path'),
    child_process = require('child_process'),
    amulet = require('../lib/rendering'),
    async = require('async'),
    argv = require('optimist').default({'ignore-whitespace': false}).argv;

  // console.log('    expected: ^' + test.expected.replace(/\n/g, '¬\n') + '$');
  // console.log('    rendered: ^' + rendered.replace(/\n/g, '¬\n') + '$');

function showError(spec, test, output) {
  return [
    '',
    'Test: ' + test.name,
    'Description: ' + test.desc,
    'Expected: ' + test.expected,
    'Actual: ' + output].join('\n');
}

function runTest(spec, test, callback) {
  amulet.emptyCache();
  amulet.parseTemplate(test.name, test.template);

  for (var partial_name in test.partials) {
    var partial_value = test.partials[partial_name];
    amulet.parseTemplate(partial_name, partial_value);
  }

  var data = test.data;
  if (data.lambda) {
    data.lambda = eval('(' + data.lambda.js + ')');
  }

  amulet.renderString(test.name, data, function(err, output) {
    var matches = output == test.expected;
    if (argv['ignore-whitespace'] && !matches)
      matches = output.replace(/\s+/g, '') == test.expected.replace(/\s+/g, '');

    if (matches) {
      process.stdout.write('.');
    }
    else {
      console.error(showError(spec, test, output));
    }

    callback();
  });
}

function runSpecFile(spec_path, specCallback) {
  var spec_contents = fs.readFileSync(spec_path);
  var spec = JSON.parse(spec_contents);

  async.forEachSeries(spec.tests, function(test, testCallback) {
    runTest(spec, test, testCallback);
  }, specCallback);
}

function run() {
  var specs_dir = path.join(__dirname, 'mustache', 'specs');
  var spec_files = fs.readdirSync(specs_dir);
  async.forEachSeries(spec_files, function(file, callback) {
    if (file.match(/^[^~]+json$/))
      runSpecFile(path.join(specs_dir, file), callback);
    else
      callback();
  }, function() { console.log("done"); });
}

if (fs.existsSync(path.join(__dirname, 'mustache', '.git'))) {
  run();
  // console.log("Updating spec repo with git pull");
  // child_process.exec('git pull', { cwd: path.join(__dirname, 'mustache'), env: process.env }, run);
}
else {
  console.log("Pulling down the spec repo with git clone");
  child_process.exec('git clone git://github.com/mustache/spec.git mustache', { cwd: __dirname, env: process.env }, run);
}

