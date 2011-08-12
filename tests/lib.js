var Stream = require('stream').Stream;
var EventEmitter = require('events').EventEmitter;

var StringStream = function() {
  this.buffer = '';
  this.writable = true;
}

StringStream.prototype = new EventEmitter();
StringStream.prototype.write = function(chunk) {
  if (this.writable)
    this.buffer += chunk;
  else
    throw new Error("Cannot write to unwritable StringStream.");
}
StringStream.prototype.end = function(arg0) {
  this.writable = false;
  this.emit('end', this.buffer);
}
StringStream.prototype.ondata = function(chunk) {
  if (this.writable)
    this.buffer += chunk;
  else
    throw new Error("Cannot write to unwritable StringStream.");
}
StringStream.prototype.onend = function() {
  this.writable = false;
  this.emit('end', this.buffer);
}
exports.StringStream = StringStream;


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
