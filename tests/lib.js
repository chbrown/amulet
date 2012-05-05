// var fs = require('fs'),
//     path = require('path'),
//     exec = require('child_process').exec,
//     Stream = require('stream').Stream,
//     EventEmitter = require('events').EventEmitter;

// var StringStream = function() {
//   this.buffer = '';
//   this.writable = true;
// };

// StringStream.prototype = new EventEmitter();
// StringStream.prototype.write = function(chunk) {
//   if (this.writable)
//     this.buffer += chunk;
//   else
//     throw new Error("Cannot write to unwritable StringStream.");
// };
// StringStream.prototype.end = function(arg0) {
//   this.writable = false;
//   this.emit('end', this.buffer);
// };
// StringStream.prototype.ondata = function(chunk) {
//   if (this.writable)
//     this.buffer += chunk;
//   else
//     throw new Error("Cannot write to unwritable StringStream.");
// };
// StringStream.prototype.onend = function() {
//   this.writable = false;
//   this.emit('end', this.buffer);
// };
// exports.StringStream = StringStream;

// node.js sucks at reading yaml
// exports.yaml2json = function(yaml, json, callback) {
//   if (!path.existsSync(json)) {
//     console.log("Json doesn't exist. Converting.");
//     return exec('yaml2json ' + yaml + ' > ' + json, callback);
//   }
//   else {
//     yaml_stats = fs.statSync(yaml);
//     json_stats = fs.statSync(json);
//     if (yaml_stats.mtime > json_stats.mtime) {
//       console.log('Yaml is newer than the json. Re-converting.');
//       return exec('yaml2json ' + yaml + ' > ' + json, callback);
//     }
//   }
//   return callback();
// };

// THE BELOW DOESN'T WORK!
// function StringStream() {
//   this.buffer = '';
// };
// StringStream.prototype = new EventEmitter();
// StringStream.prototype.write = function(chunk) {
//   this.buffer += chunk;
// };
// StringStream.prototype.end = function() {
// };
// StringStream.prototype.on = function(arg0, arg1) {
//   // console.log('StringStream.on', arg0, arg1);
// };
