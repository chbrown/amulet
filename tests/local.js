var fs = require('fs'),
    path = require('path'),
    amulet = require('../lib/amulet'),
    yaml = require('yaml');

// amulet.root(path.join(__dirname, 'examples'));

var simple_spec_yaml = fs.readFileSync('simple_spec.yaml');
var simple_spec = yaml.eval(simple_spec_yaml);
console.log('About to start through simple_spec tests.');
simple_spec.tests.forEach(function(spec) {
  console.log('Running simple spec:', spec.description);
  amulet.parseTemplate(spec.description, spec.template);
  var context = eval('(' + spec.context + ')');

  var output = '';
  var output_stream = new Stream();
  output_stream.on('data', function(chunk) {
    output += chunk;
  });
  output_stream.on('end', function() {
    if (output == spec.output) {
      console.log('Simple spec succeeded:', spec.description);
    }
    else {
      console.log('Simple spec failed:', spec.description);
      console.log('Expected output:\n', spec.output);
      console.log('Actual output:\n', output);
    }
  });

  amulet.render(spec.description, context, output_stream); // process.stdout
});
