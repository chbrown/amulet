// var fs = require('fs'),
//     path = require('path'),
//     mu = require('../lib/mu');
    
// mu.set('root', path.join(__dirname, 'examples'));

// var js = fs.readFileSync(path.join(mu.root, 'complex.js')).toString(),
//     text = fs.readFileSync(path.join(mu.root, 'complex.txt')).toString();

// js = eval('(' + js + ')');

// var RUNS = parseInt(process.argv[2] || 1000000, 10);

// mu.compile('complex.html', function (err, compiled) {
//   if (err) {
//     throw err;
//   }
  
//   //var buffer = '';
//   //mu.render('complex.html', js)
//   //  .on('data', function (c) { buffer += c.toString(); })
//   //  .on('end', function () { console.log(buffer); });
//   console.log(compiled[0].tokens[4][4]);
  
//   pump(mu.render('complex.html', js), process.stdout);

//   var i = 0, d = new Date();
  
//   (function go() {
//     if (i++ < RUNS) {
//       mu.render('complex.html', js).on('end', function () { go(); });
//     }
//   }());
  
//   process.addListener('exit', function () {
//     console.log("Time taken: " + ((new Date() - d) / 1000) + "secs");
//   });
// });
