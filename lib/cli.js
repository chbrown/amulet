#!/usr/bin/env node

var util = require('util');
var mu = require('./mu');

var input = '';

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(chunk) {
  input += chunk;
});
process.stdin.on('end', function() {

  // template = template.toString('utf8');
  // var parsed = parser.parse(template);
  // 
  // if (~process.argv.indexOf('--tokens')) {
  //   console.log(util.inspect(parsed, false, 20));
  //   return;
  // }
  // 
  // process.argv.forEach(function (arg) {
  //   if (arg.indexOf('--view=') === 0) {
  //     try {
  //       var view = eval('(' + arg.replace('--view=', '') + ')');
  //     } catch (e) {
  //       console.log('\nData: ' + arg.replace('--view=', ''));
  //       throw e;
  //     }
  // 
  //     mu.renderText(template, view).on('data', util.print);
  //       // .on('data', function (d) {
  //       //   util.print(d);
  //       // });
  //   }
  // });

});

