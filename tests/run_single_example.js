var fs     = require('fs'),
    path   = require('path'),
    util   = require('util'),
    mu     = require('../lib/mu')

mu.root = path.join(__dirname, 'examples');

var args = process.argv.slice(2) || ['complex']
var last_arg = args[args.length - 1]

var js   = fs.readFileSync(path.join(mu.root, last_arg + '.js' )).toString()
var text = fs.readFileSync(path.join(mu.root, last_arg + '.txt')).toString()
var evaluated_js = eval('(' + js + ')')

var template_names = args.map(function(x) { return x + '.html' })

pair = mu.start_render(template_names, {}, function() { 
  //process.stdout.write('Done!')
})
// [0] is the stream, [1] is the controller

var stream = pair[0]
var controller = pair[1]
stream.pipe(process.stdout)

setTimeout(function() {
  controller.add('text', 'Goodness graci---')
}, 1500)

setTimeout(function() {
  controller.force()
}, 3000)

  // controller.force()

// mu.compile(example + '.html', function (err, compiled) {
//   if (err) {
//     throw err;
//   }
//   
//   console.log(util.inspect(compiled, false, null));
//   
//   
// })
