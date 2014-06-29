/*jslint node: true */
var http = require('http');
var portfinder = require('portfinder');
var amulet = require('../..').set({root: __dirname + '/templates'});

// initialize the app
portfinder.getPort(function(err, port) {
  var hostname = '127.0.0.1';
  http.createServer(function(req, res) {
    // this full request takes about 5s on my macbook air
    res.writeHead(200, {'Content-Type': 'text/html'});
    var a = 0;
    var b = 1;

    var ctx = {
      header: 'Fibonacci sequence',
      spacer: new Array(100).join('&nbsp;'),
    };
    var renderer = amulet.stream(['layout.mu', 'fibonacci.mu'], ctx, true);
    renderer.pipe(res);
    (function loop(i) {
      // busy work. should take about .03s
      for (var j = 0; j < 3000000; j++) Math.random();

      var sum = a + b;
      a = b;
      b = sum;

      if (i == 1000) {
        renderer.extendContext({thousand: sum});
      }
      else {
        if (i == 100) {
          renderer.extendContext({hundred: sum});
        }
        else if (i == 10) {
          renderer.extendContext({ten: sum});
        }
        else if (i == 1) {
          renderer.extendContext({one: sum});
        }
        setImmediate(function() {
          loop(i + 1);
        });
      }
    })(0);
  }).listen(port, hostname, function() {
    var root = 'http://' + hostname + ':' + port;

    // run tests. Place `return;` here to run the app without the test
    var tap = require('tap');
    var request = require('request');

    tap.test('long response server', function(t) {
      request.get(root, function(err, response, html) {
        t.similar(html, /927372692193079200000/, 'response should contain 100th value in fibonacci sequence');
        t.end();
        process.exit();
      });
    });
  });
});
