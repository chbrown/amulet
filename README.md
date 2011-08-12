# [chbrown/Amulet] - Mustache template compiler for Node.js

Mustache is a simple, restricted, fast template language inspired by [ctemplate](http://code.google.com/p/google-ctemplate/). There is a great introduction to the language [here on github](http://mustache.github.com/mustache.5.html).

[chbrown/Amulet] itself began as a fork of the v2 branch of [raycmorgan/Mu], but eventually the API changed so much, and so many Mustache-particular specificities were not followed, that I decided to rename it. Amulet implements all of the Mustache specification, except that it does not always honor the whitespace requirements, which, for the purposes of HTML, does not matter. Also, Amulet extends past the Mustache specification.

## Why chbrown/Amulet when there's raycmorgan/Mu?

raycmorgan/Mu is actually faster for certain benchmarks, because the template rendering itself is synchronous. Amulet does everything A.S.A.P., and so it will start rendering your templates before any of your context variables are available, only halting when it encounters a missing variable. Ever wonder why PHP appears so fast, while sucking so much at everything else? It's because PHP renders as soon as possible, so that the top 90% of the page gets rendered before some cpu-intensive bit even gets called to render the footer. That's what Amulet does, too, basically.

Still, like raycmorgan/Mu, Amulet
* Is very fast
* Supports asynchronous parsing and compiling
* Renders streamingly

Also, work on Mu died off in the middle of 2010, and so it has many relics from Node.js 0.3.

# License

MIT Licensed, 2010-2011

# Benchmarks

Rendering examples/complex.html.mu 1 million times yields the following results:

    Ruby Mustache - 112 secs  (benchmarks/rb/complex_view.rb)
               Mu -  40 secs  (benchmarks/million_complex.js)

Tested on a 2.4 GHz Intel Core 2 Duo MacBook Pro

Mu sync rendering was benchmarking in at 24 secs, but I felt it was much more
important to stream the rendering. Streaming adds a pretty set overhead of
about 14µs (microseconds) to each template render to setup the event emitter.
It also adds a variable extra amount of time due to the additional function calls.
The million_complex.js caused 2µs per render addition.


Usage (from demo.js)
--------------------

    var sys = require('sys');
    var Mu = require('./lib/mu');

    Mu.templateRoot = './examples';

    var ctx = {
      name: "Chris",
      value: 10000,
      taxed_value: function() {
        return this.value - (this.value * 0.4);
      },
      in_ca: true
    };

    Mu.render('simple.html', ctx, {}, function (err, output) {
      if (err) {
        throw err;
      }
      
      var buffer = '';

      output.addListener('data', function (c) {buffer += c; })
            .addListener('end', function () { sys.puts(buffer); });
    });
    

Which yields:

    Hello Chris
    You have just won $10000!
    Well, $6000, after taxes.
    
Using Mu.compileText
--------------------

    var sys = require('sys');
    var Mu = require('./lib/mu');

    var tmpl = "Hello {{> part}}. Your name is: {{name}}!";
    var partials = {part: "World"};
    var compiled = Mu.compileText(tmpl, partials);
    
    compiled({name: "Chris"})
      .addListener('data', function (c) { sys.puts(c) });


Mustache Documentation
----------------------

See **Tag Types** section at
[http://github.com/defunkt/mustache/](http://github.com/defunkt/mustache/) 
for more information on supported tags.

Todo
----

* Better parse time errors. Currently they are decent when partials are not involved
  but break down once partials are involved.
* Implement some compile time optimizations. The big one is predetermining when a
  enumerable actually needs to inherit the full context. Cutting this out can be huge.
* Cleanup the Preprocessor methods. They are a bit unwieldy.  
