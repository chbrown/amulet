var amulet = require('../lib/rendering.js');
var spacer = (new Array(100)).join('&nbsp;');
require('http').createServer(function(req, res) {
  if (req.url === '/fib') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    var context = {header: 'Fibonacci sequence', spacer: spacer};
    var renderer = amulet.render(res, ['layout.mu', 'fib.mu'], context, true);
    var a = 0, b = 1, c = -1, i = 0;
    (function next() {
      for (var j = 0; j < 500000; j++) {
        var dummy = Math.random();
      }
      c = a + b;
      a = b;
      b = c;
      if (i === 1)
        renderer.extendContext({one: c});
      if (i === 10)
        renderer.extendContext({ten: c});
      if (i === 100)
        renderer.extendContext({hundred: c});
      if (i === 1000)
        renderer.extendContext({thousand: c});
      i++;
      if (i < 1001)
        process.nextTick(next);
    })();
  }
  else {
    amulet.render(res, ['layout.mu', 'hello.mu']);
  }
}).listen(8080);
