var sys = require('sys')
    fs = require('fs'),
    Path = require('path'),
    mu = require('../lib/mu')
mu.root(__dirname) // __filename

var complex_context = {
  header: function() {
    return "Colors"
  },
  item: [
    {name: "red", current: true, url: "#Red"},
    {name: "green", current: false, url: "#Green"},
    {name: "blue", current: false, url: "#Blue"}
  ],
  link: function() {
    return this["current"] !== true
  },
  list: function() {
    return this.item.length !== 0
  },
  empty: function() {
    return this.item.length === 0
  }
}

var i = 0
console.log("Starting timer...")
console.time('Total time');
(function next() {
  if (i++ < 1000000)
    mu.render(['million_complex.mustache'], complex_context, null, next)
  else
    console.timeEnd('Total time')
})()
