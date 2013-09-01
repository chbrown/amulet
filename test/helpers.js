'use strict'; /*jslint es5: true, node: true, indent: 2 */
var tap = require('tap');

var helpers = require('../lib/helpers');

tap.test('helpers.extend', function(t) {
  var original = {
    name: 'Robert',
    status: 'child',
    age: 8,
  };
  var defaults = {
    pants: 'jeans',
    hat: null,
    age: 18,
  };
  var destination = {};
  var merged = helpers.extend(destination, defaults, original);

  t.equivalent(merged, destination, 'destination should be filled and returned');
  t.equivalent(Object.keys(merged).sort(), ['age', 'hat', 'name', 'pants', 'status'],
    'merged should contain fields from both original and defaults');
  t.equal(original.age, 8, "original's age should not have changed");
  t.equal(defaults.age, 18, "defaults's age should come from original");
  t.equal(merged.age, 8, "merged's age should come from original");
  t.end();
});

tap.test('helpers.escapeHtmlString', function(t) {
  t.equal(helpers.escapeHtmlString('Hello<br/>world'), 'Hello&lt;br/&gt;world',
    'escaped output should escape all special xml entities');
  t.equal(helpers.escapeHtmlString('1 + 4 <= 5 &amp;&amp; 2 > "1"'), '1 + 4 &lt;= 5 &amp;amp;&amp;amp; 2 &gt; &quot;1&quot;',
    'escaped output should escape all even partial xml entities');
  t.end();
});
