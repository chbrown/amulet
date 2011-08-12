# [amulet](https://github.com/chbrown/amulet) - Mustache template compiler for Node.js

Mustache is a simple, restricted, fast template language inspired by [ctemplate](http://code.google.com/p/google-ctemplate/). There is a great introduction to the language [here on github](http://mustache.github.com/mustache.5.html). And a nice overview of the different tags at the [ruby implementation](http://github.com/defunkt/mustache/).

[chbrown/amulet](https://github.com/chbrown/amulet) itself began as a fork of the v2 branch of [raycmorgan](https://github.com/raycmorgan)'s [Mu](https://github.com/raycmorgan/Mu), but eventually the API changed so much, and so many Mustache-particular specificities were not followed, that I decided to rename it. Amulet implements all of the Mustache specification, except that it does not always honor the whitespace requirements, which, for the purposes of HTML, does not matter. Also, amulet extends past the Mustache specification.

## Why [amulet](https://github.com/chbrown/amulet) when there's raycmorgan/Mu?

Mu is actually faster for certain benchmarks, because the template rendering itself is synchronous. Amulet does everything A.S.A.P., and so it will start rendering your templates before any of your context variables are available, only halting when it encounters a missing variable. Ever wonder why PHP appears so fast, while sucking so much at everything else? It's because PHP renders as soon as possible, so that the top 90% of the page gets rendered before some cpu-intensive bit even gets called to render the footer. That's what amulet does, too, basically.

Still, like [Mu](https://github.com/raycmorgan/Mu), amulet

* Is very fast
* Supports asynchronous parsing and compiling
* Renders streamingly

Also, work on Mu died off in the middle of 2010, and so it has many relics from Node.js 0.3.

# License

MIT Licensed, 2010-2011
