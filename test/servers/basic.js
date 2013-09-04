'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var http = require('http');
var portfinder = require('portfinder');
var amulet = require('../..');

// initialize the app
portfinder.getPort(function(err, port) {
  var hostname = '127.0.0.1';
  http.createServer(function(req, res) {
    if (req.url == '/hello') {
      res.writeHead(200, {'Content-Type': 'text/html'});
      amulet.stream(['layout.mu', 'hello.mu'], {name: 'World'}).pipe(res);
    }
    else if (req.url == '/hello.partial') {
      res.writeHead(200, {'Content-Type': 'text/x-html-snippet'});
      amulet.stream(['hello.mu'], {name: 'World'}).pipe(res);
    }
    else {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Could not find that page.');
    }
  }).listen(port, hostname, function() {
    var root = 'http://' + hostname + ':' + port;

    var tap = require('tap');
    var request = require('request');

    tap.test('long response server', function(t) {

      t.plan(8);

      request.get(root + '/hello', function(err, response, html) {
        t.notOk(err, '/hello request should not raise error');
        t.similar(html, /World/, 'result should contain name value');
        t.similar(html, /content=.amulet./, 'result should contain meta-engine tag content');
      });

      request.get(root + '/hello.partial', function(err, response, html) {
        t.notOk(err, '/hello.partial request should not raise error');
        t.similar(html, /World/, 'result should contain name value');
        t.notSimilar(html, /content=.amulet./, 'html should NOT contain meta-engine tag content');
      });

      request.get(root + '/other', function(err, response, html) {
        t.notOk(err, '/other should not raise error (in the connection)');
        t.equal(response.statusCode, 404, '/other should return a 404');
      });

      setTimeout(function() {
        // give the request .1s to run. if it takes longer than that, something's wrong.
        // so this is both a hack and a benchmarking test.
        process.exit();
      }, 100);
    });
  });
});
