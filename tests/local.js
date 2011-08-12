var fs = require('fs'),
    path = require('path'),
    amulet = require('../lib/amulet'),
    Stream = require('stream').Stream,
    // EventEmitter = require('events').EventEmitter,
    Buffer = require('buffer').Buffer,
    StringStream = require('./lib').StringStream,
    exec = require('child_process').exec,
    yaml = require('yaml');

// amulet.root(path.join(__dirname, 'examples'));
var ignore_whitespace = true;
console.log('ignore_whitespace=', ignore_whitespace);

var simple_spec = null;

function start(callback) {
  var simple_spec_json = fs.readFileSync('simple_spec.json');
  simple_spec = JSON.parse(simple_spec_json);
  callback();
}
var i = 0;
function next() {
  if (i < simple_spec.tests.length) {
    var spec = simple_spec.tests[i++];
    console.log('Simple spec:', spec.description);
    amulet.parseTemplate(spec.description, spec.template);
    try {
      var context = eval('(' + spec.context + ')');
    }
    catch (e) {
      console.error('Reading context failed', e, spec.context);
    }

    var string_stream = new StringStream();
    amulet.render(spec.description, context, string_stream, function() { // process.stdout
      // var success = false;
      if (string_stream.buffer == spec.output) {
        console.log('  Succeeded:', spec.description);
      } 
      else if (ignore_whitespace && string_stream.buffer.replace(/\s+/g, '') == spec.output.replace(/\s+/g, '')) {
        console.log('  Succeeded:', spec.description);
      }
      else {
        console.log(
          '     Failed:', spec.description,
          '\n  Expected output:\n', spec.output,
          '\n  Actual output:\n', string_stream.buffer);
      }

      next();
    });
  }
  else {
    console.log('Done with simple_spec tests');
  }
}

// node.js sucks at reading yaml
yaml_stats = fs.statSync('simple_spec.yaml');
json_stats = fs.statSync('simple_spec.json');
if (yaml_stats.mtime > json_stats.mtime) {
  console.log('Yaml is newer than the json -- re-converting.');
  exec('yaml2json simple_spec.yaml > simple_spec.json', function (error, stdout, stderr) {
    start(next);
  });
}
else {
  start(next);
}