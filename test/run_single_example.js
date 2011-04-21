var fs     = require('fs'),
    path   = require('path'),
    util   = require('util'),
    mu     = require('../lib/mu'),
    pump   = require('util').pump;

mu.root = path.join(__dirname, 'examples');

var args = process.argv.slice(2) || ['complex']
var last_arg = args[args.length - 1]

var js   = fs.readFileSync(path.join(mu.root, last_arg + '.js' )).toString()
var text = fs.readFileSync(path.join(mu.root, last_arg + '.txt')).toString()
var evaluated_js = eval('(' + js + ')')

var template_names = args.map(function(x) { return x + '.html' })
// console.log('Calling mu.render from tests with: ' + template_names)
mu.render(template_names, evaluated_js).pipe(process.stdout)

// mu.compile(example + '.html', function (err, compiled) {
//   if (err) {
//     throw err;
//   }
//   
//   console.log(util.inspect(compiled, false, null));
//   
//   
// })
