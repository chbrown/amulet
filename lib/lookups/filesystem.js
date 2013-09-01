'use strict'; /*jslint es5: true, node: true, indent: 2 */
var fs = require('fs');
var path = require('path');
var util = require('util');

var Lookup = require('./');

var FilesystemLookup = module.exports = function(root) {
  this.root = root;
};
util.inherits(FilesystemLookup, Lookup);

FilesystemLookup.prototype.get = function(template_name, callback) {
  /** `get`: Given a template name, read it from disk.

  `callback`: function(Error | undefined, String | undefined)
  */
  // var self = this;
  var fullpath = template_name[0] == '/' ? template_name : path.join(this.root, template_name);
  fs.readFile(fullpath, 'utf8', callback);
};

FilesystemLookup.prototype.find = function(callback) {
  /** `find`: recurse through the paths below `lookup.root`, asynchronously,
  returning all files that end with `.mu`

  `callback`: function(Error | null, [String] | null)
      Function to call when all files have been parsed (optional)
  */
  var self = this;
  var filepaths = [];
  var find_relative = function(relative_root, callback) {
    /** find_relative: much the same as find, but with a specified directory
    to start at, unlike find.

    `relative`: String path relative to `lookup.root` to look for templates.
    `callback`: function(Error | null)
    */
    var dirpath = path.join(self.root, relative_root);
    fs.readdir(dirpath, function(err, files) {
      if (err) return callback(err);

      (function next(err) {
        if (err) return callback(err);

        var file = files.shift();
        if (file) {
          var absolute_path = path.join(self.root, relative_root, file);
          fs.stat(absolute_path, function(err, stats) {
            if (err) return callback(err);

            var relative_path = path.join(relative_root, file);
            if (stats.isDirectory()) {
              // recurse into subfolder
              find_relative(relative_path, next);
            }
            else {
              if (file.match(/\.mu$/)) {
                filepaths.push(relative_path);
              }
              next();
            }
          });
        }
        else {
          callback();
        }
      })();
    });
  };

  find_relative('.', function(err) {
    callback(err, filepaths);
  });
};
