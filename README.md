# [amulet](https://github.com/chbrown/amulet) - Mustache template compiler for Node.js

Mustache is a simple, restricted, fast template language inspired by [ctemplate](http://code.google.com/p/google-ctemplate/). There is a great introduction to the language [here on github](http://mustache.github.com/mustache.5.html). And a nice overview of the different tags at the [ruby implementation](http://github.com/defunkt/mustache/).

[amulet](https://github.com/chbrown/amulet) itself began as a fork of the v2 branch of [raycmorgan](https://github.com/raycmorgan)'s [Mu](https://github.com/raycmorgan/Mu), but eventually the API changed so much, and so many Mustache-particular specificities were not followed, that I decided to rename it. Amulet implements all of the Mustache specification, except that it does not always honor the whitespace requirements, which, for the purposes of HTML, does not matter. (Obeying the white-space conventions is on the to-do list.) Also, amulet extends past the Mustache specification.

## Why [amulet](https://github.com/chbrown/amulet) when there's [Mu](https://github.com/raycmorgan/Mu)?

[Mu](https://github.com/raycmorgan/Mu) is actually faster for certain benchmarks, because the template rendering itself is synchronous. Amulet does everything ASAP (as soon as possible), and so it will start rendering your templates before any of your context variables are available, only halting when it encounters a missing variable (this functionality is optional -- but if you you're not ever going to use it, you'll probably be better off with plain old Mu). Ever wonder why PHP appears so fast, while sucking so much at everything else? It's because PHP renders as soon as possible, so that the top 90% of the page gets rendered before some cpu-intensive bit even gets called to render the footer. That's what amulet does, too, basically.

Still, like [Mu](https://github.com/raycmorgan/Mu), amulet

* Is very fast
* Supports asynchronous parsing and compiling
* Renders streamingly

Also, work on [Mu](https://github.com/raycmorgan/Mu) died off in the middle of 2010, and so it has many relics from Node.js 0.3.

# License

MIT Licensed, 2010-2011


var mu = require('./mu');

var input = '';

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(chunk) {
  input += chunk;
});
process.stdin.once('end', function() {