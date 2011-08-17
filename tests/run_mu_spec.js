var exec = require('child_process').exec,
    path = require('path'),
    fs = require('fs'),
    yaml = require('yaml'),
    mu = require('../lib/mu'),
    Stream = require('stream').Stream

var spec_repo_path = path.join(__dirname, 'spec')

function spec_repo_available() {
  var specs_path = path.join(spec_repo_path, 'specs')
  var specs_files = fs.readdirSync(specs_path)
  // specs_files.forEach(function(spec_file) {
  
  function callback() { 
    console.log("Done with all tests."); 
  }
  
  function next_spec() {
    var spec_file = specs_files.shift()
    if (!spec_file) {
      // done!
      return callback()
    }
    else if (spec_file.match(/\.json$/)) {
      // console.log("yaml.eval: ", path.join(specs_path, spec_file))
      var spec_contents = fs.readFileSync(path.join(specs_path, spec_file))
      // var spec = yaml.eval(spec_contents)
      var spec = JSON.parse(spec_contents)
      // console.log(spec)
      console.log('\n\nTesting ' + spec_file);
      console.log(spec.overview)
      
      function next_test() {
        var test = spec.tests.shift()
        if (!test) {
          console.log("\n  Done with this spec's tests")
          // done with all the tests in this spec!
          return next_spec()
        }
        else {
          console.log('\n  Test: ' + test.name)
          console.log('  Description: ' + test.desc)
      
          var template_key = spec_file + ':' + test.name
          mu.cache.compileStringSync(template_key, test.template)
      
          for (var partial_name in test.partials) {
            var partial_value = test.partials[partial_name]
            // console.log("adding to cache: ", partial_name, " = ", partial_value)
            mu.cache.compileStringSync(partial_name, partial_value)
          }
        
          // var string_stream = new Stream()
          var rendered = ''
          
          var data = test.data
          if (data.lambda) {
            data.lambda = eval('(' + data.lambda.js + ')')
          }
            
          
          var renderer = mu.render([template_key], test.data, null, false, function(err) {
            if (err)
              throw err
            if (test.expected == rendered) {
              console.log('++ SUCCESS')
            }
            else {
              console.log('-- FAILURE')
              console.log('    expected: ^' + test.expected.replace(/\n/g, '¬\n') + '$')
              console.log('    rendered: ^' + rendered.replace(/\n/g, '¬\n') + '$')
            }
            // loop
            next_test()
          })

          renderer.stream.on('data', function(data) {
            rendered += data
          })
          renderer.stream.once('end', function() {
            // console.log('      string_stream ended')
          })

        }
      }
      next_test()
    }
    else {
      // loop
      next_spec()
    }
  }
  next_spec()
}

if (process.ARGV[2] === '--nocheck') {
  spec_repo_available()
}
else if (path.existsSync(path.join(spec_repo_path, '.git'))) {
  // encoding: 'utf8',
  // timeout: 0,
  // maxBuffer: 200*1024,
  // killSignal: 'SIGTERM',
  var options = { cwd: spec_repo_path, env: process.env }
  console.log("Updating spec repo with git pull")
  exec('git pull', options, spec_repo_available)
}
else {
  var options = { cwd: __dirname, env: process.env }
  console.log("Pulling down the spec repo with git clone")
  exec('git clone git://github.com/mustache/spec.git', options, spec_repo_available)
}
    
