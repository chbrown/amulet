var tap = require('tap');

tap.test('basic import', function(t) {
  var amulet = require('..');
  t.ok(amulet, 'amulet should import from parent directory');
  t.end();
});
