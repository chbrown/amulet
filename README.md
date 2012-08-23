[![build status](https://secure.travis-ci.org/chbrown/amulet.png)](http://travis-ci.org/chbrown/amulet)
# Amulet - Mustache templating for Node.js

Mustache is a simple, restricted, fast template language inspired by [ctemplate](http://code.google.com/p/google-ctemplate/). There is a great introduction to the language [here on github](http://mustache.github.com/mustache.5.html). And a nice overview of the different tags at the [ruby implementation](http://github.com/defunkt/mustache/).

Amulet began as a fork of the v2 branch of [raycmorgan](https://github.com/raycmorgan)'s [Mu](https://github.com/raycmorgan/Mu). I eventually changed so much of the API that I decided to rename it.
Amulet attempts/intends to implement all of the Mustache specification, except that it does not always honor the whitespace requirements, which, for the purposes of HTML, does not matter. (Obeying the white-space conventions is on the to-do list.)

### Quickstart guide:

*layout.mu*

    <!DOCTYPE html>
    <meta name="engine" content="amulet">
    <div id="container">
        {{<}}
    </div>

*hello.mu*

    <p>Hello world!</p>

*fib.mu*

    <h2>{{header}}</h2>            {{{spacer}}}
    <!-- the spacers are there just to convince
         your browser that it has enough content
         to merit rendering -->

    <p>One: {{one}}</p>            {{{spacer}}}
    <p>Ten: {{ten}}</p>            {{{spacer}}}
    <p>Hundred: {{hundred}}</p>    {{{spacer}}}
    <p>Thousand: {{thousand}}</p>

*app.js*

    var amulet = require('amulet');
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

This example code can be found in `example/`

The main function, `amulet.render`, can be called in a few variations. The basic signature is `function(output, templates, context, asap, callback)`, but a number of the arguments are optional (`output` is the only required argument):

With callback:

    amulet.render(res, ['layout.mu', 'page.mu'], context, true, function() {
        console.log("Done rendering!");
    });

`asap` defaults to false:

    amulet.render(res, 'static.mu', function() { console.log("Done!"); });

With single template:

    var renderer = amulet.render(res, 'one.mu', {first: 'Chris'}, true);

`amulet.render` always returns a Renderer object, which is useful if you want a way to add context or force it to end.

*one.mu*

    <h3>{{first}} {{last}}</h3>
    <p>{{description}}</p>

*app.js (snippet)*:

    renderer.extendContext({last: 'Brown'});

At this point, the renderer would output up to the `<p>`
and then pause, waiting for the description variable to be filled.
But if you decide you want it to skip over the missing variables,
as any basic Mustache spec would do:

    renderer.force();

Which sets `asap` to false, and immediately streams through the rest of your template.



## Why Amulet when there's [Mu](https://github.com/raycmorgan/Mu)?

[Mu](https://github.com/raycmorgan/Mu) is faster for certain benchmarks, because the template rendering itself is synchronous. Amulet does everything A.S.A.P. (as soon as possible), so it will start rendering your templates before any of your context variables are available, only halting when it encounters a missing variable. This functionality is optional -- if you want to render a template with one command, you still can.

PHP appears so fast (while sucking so much at everything else) because it renders as soon as possible, so that the top 90% of the page gets rendered before some cpu-intensive bit gets called to render the footer. That's what Amulet does, too, basically.

Like Mu, Amulet

* Is very fast
* Supports asynchronous parsing and compiling
* Renders streamingly

Beyond Mu, Amulet

* Supports template hierarchies
* Renders as soon as possible, pausing only to wait for missing variables from the controller
* Adds a number of helpers to the Mustache specification

# Additives

Amulet is Mustache and then some:

### Piping

If a method is in global scope, you can pipe a variable through it:

    <pre>{{{doc | JSON.stringify}}}</pre>

Which would return something like

    <pre>{"_id": "0x1"}</pre>

### Object notation

Instead of having to nest sections to dig into an object:

    {{#obj}}
        {{#prop}}
            {{val}}
        {{/prop}}
    {{/obj}}

You can just dot a path. Like javascript.

    {{obj.prop.val}}

### DRY

Don't repeat yourself; namely, don't use XML-type redundancy. A Mustache template is a directed acyclic graph (DAG), i.e. a tree, meaning that a closing node is never ambiguous. You needn't tell the Amulet parser what you're closing. It already knows.

    {{#obj}}
        {{#prop}}
            {{val}}
        {{/}}
    {{/}}

### Yields

When rendering a template hierarchy, use a `<` in your master layout (the opposite of the partial symbol `>`):

*layout.mu*

    <!DOCTYPE html>
    {{<}}

*index.mu*

    <p>Just the facts.</p>

Output of `amulet.render(response, ['layout.mu', 'index.mu'])`:

    <!DOCTYPE html>
    <p>Just the facts.</p>

To make it easier to remember what `<` does, you can also write `{{<yield}}` or even `{{<yield/>}}` to make your syntax highlighter happy. As soon as the parser sees the `<` character, it will skip to the end of the mustache tag.

### Arrows

To keep better track of scope, you can name your sectioned variables with the `->` symbol:

    {{#people -> person}}
        {{person.first_name}}
    {{/}}

Otherwise, you can access the local scope nakedly or with a `_`:

    {{#people}}
        {{_.first_name}}
        {{last_name}}
    {{/}}


# License

MIT Licensed, 2010-2012

See <https://github.com/chbrown/amulet/blob/master/LICENSE>
