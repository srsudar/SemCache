> SemCache

# Overview

This is the code for the Chrome App portion of SemCache. The app is responsible
for interacting with the file system and sockets--permissions that are
available to Chrome Apps but not to Chrome extensions.

# Building

## Build Overview

There are two main sections of the codebase: the JS logic and the HTML user
interface. The JS is written using
[browserify](https://github.com/substack/node-browserify). This allows code to
be written using the familiar `require()` syntax from node. 

The HTML UI is written using [Polymer](https://www.polymer-project.org/1.0/).
This requires a few extra steps for Chrome Apps, which prevent things like
navigation via `<a href="...">` and `window.location`. Instead, the process
uses Polymer routing and [vulcanize](https://github.com/Polymer/vulcanize) to
stick everything in one giant file.

Chrome Apps are also subject to a stringent Content Security Policy (CSP),
where inline scripts (i.e. scripts in a `<script>` tag) are forbidden. Polymer
makes extensive use of inline scripts, so we use
[crisper](https://github.com/PolymerLabs/crisper) to pull out all the inline
scripts into an external file.

[Grunt](http://gruntjs.com/) is used for simplfying the build process. The
manual steps here will soon be moving to Grunt.

## Build Process

To build the code, first install the global tools necessary:

```
npm install -g tape
npm install -g bower
npm install -g vulcanize
npm install -g crisper
npm install -g grunt-cli
```

Then install dependencies:
```
npm install
bower install
```

To build the JS code we use browserify, which is specified in a Grunt task so
we only need to use grunt:

```
grunt
```

Building the UI is slightly more complicated, as we have to run the step
manually as opposed to via Grunt. This command tells `vulcanize` to treat
`app/polymer-ui/index.html` as our raw HTML file, and to perform all the HTML
imports while inlining all scripts. `crisper` then extracts all the inline
scripts to a single file and writes both the final `index.html` and `index.js`
file to `app/`.

```
cd app/polymer-ui
vulcanize --inline-scripts --inline-css index.html | crisper --html ../index.html --js ../index.js
```

# Testing

Tests are written using [tape](https://github.com/substack/tape)
[web-component-tester](https://github.com/Polymer/web-component-tester).

All tests are run from the `chromeapp/` directory.

Run the JS tests (note that you have to have `**` double star globbing on in
your shell):
```
tape test/scripts/**/*.js
```

Some of the Polymer components also have tests (note that you have to have
Chrome installed, as `wct` in the project is configured to only run in Chrome):
```
wct test/polymer-ui/elements/*
```


# Service Discovery

Service discovery is performed using multicast DNS (mDNS) and DNS Service
Discovery (DNS-SD). These are companion protocols that work together to allow
automatic discovery to be performed on a local network. Multicast DNS allows a
network of machines to respond to DNS requests. DNS-SD allows DNS records to be
used to advertise requests.

## Implementation

The service discovery code lives in `app/scripts/dnssd/`. Example usage is as
follows. Modules are created as CommonJS modules and exposed via browserify and
the Grunt buildscript.

```javascript
var dnsc = require('dnsc');
var dnsSem = require('dnsSem');

// Start the DNS server.
dnsc.start();

// Register a SemCache instance. This will fail if the host (laptop.local) or
// the instance name (My Cache) are already in use on the local network.
dnsSem.registerSemCache('laptop.local', 'My Cache', 8888);

// Browse for SemCache instances.
dnsSem.browseForSemCacheInstances().then(instanceList => {
  instanceList.forEach(instance => {
    console.log(instance);
  });
});
```
