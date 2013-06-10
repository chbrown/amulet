'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var path = require('path');
var parse = require('./parse');

var TemplateLookup = module.exports = function() {
  this.root = '';
  this.minify = false;
  this.cache = {};
};

TemplateLookup.prototype.resolve = function(to) {
  return path.join(this.root, to);
};

// Items in the cache are keyed by filepath, relative to SETTINGS.root or absolute,
//   based on whether the given filepath starts with a '/' or not.
// Hits the in-Node cache to see if the template exists. If it does, this'll
// call the callback pretty quickly, but if there's a cache miss, it'll have
// to read the file and then parse it (compileFilename).
TemplateLookup.prototype.get = function(template_name, callback) {
  var self = this;
  // callback signature: function(err, template_tokens)
  if (this.cache[template_name]) {
    // force this to be truly async
    setImmediate(function() {
      callback(null, self.cache[template_name]);
    });
  }
  else {
    var fullpath = template_name[0] === '/' ? template_name : this.resolve(template_name);
    fs.readFile(fullpath, 'utf8', function(err, data) {
      if (err) {
        console.error('Cannot find the template "' + template_name + '".');
        callback(err);
      }
      else {
        self.cache[template_name] = parse(data, self.minify);
        callback(err, self.cache[template_name]);
      }
    });
  }
};

TemplateLookup.prototype._precompile = function(relative, callback) {
  // callback signature: function(err)
  var self = this;
  // this recurses through the paths below root, asynchronously,
  //   and parses them as templates if they end with .mu
  fs.readdir(this.resolve(relative), function(err, files) {
    if (err) console.error(err);
    (function next(err) {
      if (err) console.error(err);

      var file = files.shift();
      if (file) {
        var subrelative = path.join(relative, file);
        var fullpath = self.resolve(subrelative);
        fs.stat(fullpath, function (err, stats) {
          if (err) console.error(err);
          if (stats.isDirectory()) {
            // recurse into this sub-directory
            self._precompile(subrelative, next);
          }
          else if (file.match(/\.mu$/)) {
            fs.readFile(fullpath, 'utf8', function(err, data) {
              if (err) console.error(err);
              self.cache[subrelative] = parse(data, self.minify);
            });
          }
        });
      }
      else if (callback) {
        callback();
      }
    })();
  });
};

TemplateLookup.prototype.precompile = function() {
  this._precompile('.');
};
