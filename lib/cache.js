/*jslint node: true */

var Cache = module.exports = function(lookup, parser) {
  // this.templates is an in-memory cache of templates
  this.templates = {};

  // this.lookup implements `get()` and `find()` methods.
  this.lookup = lookup;
  // this.parser implements a `parse()` method
  this.parser = parser;
};

Cache.prototype.get = function(template_name, callback) {
  /** `get`: use a template name to get a template, either from the in-memory cache,
  or from the lookup. Asynchronous, even when the cache is warm.

  Templates in the cache are keyed by filepath:
      * absolute if the filepath starts with a '/' or not.
      * relative otherwise, to some root that the lookup is given.

  `template_name`: String
  `callback`: function(Error | undefined, [Object])
      `[Object]` is the template root, a.k.a. "tokens"
  */
  var cached_template = this.templates[template_name];
  if (cached_template) {
    // force this to be truly async
    setImmediate(function() {
      callback(undefined, cached_template);
    });
  }
  else {
    var self = this;
    this.lookup.get(template_name, function(err, template_string) {
      if (err) return callback(err);

      var root = self.parser.parse(template_string);
      self.templates[template_name] = root;
      callback(undefined, root);
    });
  }
};

Cache.prototype.reset = function() {
  this.templates = {};
};
