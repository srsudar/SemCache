> SemCache

# Overview

This is the code for the Chrome App portion of SemCache. The app is responsible
for interacting with the file system and sockets--permissions that are
available to Chrome Apps but not to Chrome extensions.

# Running

The built code is checked into git and is located in the `dist/` directory.
This is a conscious decision to facilitate use even by those without the build
tools installed.

Go to `chrome://extensions`, check the `Enable Developer Mode` box in the top
right. Click `Load Unpacked Extension` and select the `dist/` directory.

If necessary, click `launch`. The UI should open. Select `Settings` and
complete the settings, click `Save Settings`, then right click and select
`Reload App`. (This step will be removed in the future.) Click the `Start`
toggle.

You should now be able to browse your own cache and see other users on the
network.


# Building

## Build Overview

There are two main sections of the codebase: the JS logic and the HTML user
interface. The JS is written using
[browserify](https://github.com/substack/node-browserify). This allows code to
be written using the familiar `require()` syntax from node. 

The HTML UI is written using [Polymer](https://www.polymer-project.org/1.0/).
This requires a few extra steps for Chrome Apps, which disallow things like
navigation via `<a href="...">` and `window.location`. Instead, the process
uses Polymer routing and [vulcanize](https://github.com/Polymer/vulcanize) to
stick everything in one giant file.

Chrome Apps are also subject to a stringent Content Security Policy (CSP),
where inline scripts (i.e. scripts in a `<script>` tag) are forbidden. Polymer
makes extensive use of inline scripts, so we use
[crisper](https://github.com/PolymerLabs/crisper) to pull out all the inline
scripts into an external file.

[Grunt](http://gruntjs.com/) is used for simplifying the build process, hiding
much of the manual labor required for `browserify` and `vulcanize`/`crisper`.

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

The code will be built and ready to deploy in the `dist/` directory.

## Manually Building the UI

First run `grunt browserify` to build the JS bundles we depend on.

Then run the following command. This tells `vulcanize` to treat
`app/polymer-ui/index.html` as our raw HTML file, and to perform all the HTML
imports while inlining all scripts. `crisper` then extracts all the inline
scripts to a single file and writes both the final `index.html` and `index.js`
file to `app/`.

```
cd app/polymer-ui
vulcanize --inline-scripts --inline-css index.html | crisper --html ../index.html --js ../index.js
```

To remove the bundles (so that we don't have any compiled code in `app/`, run
`grunt clean:bundles`.

# Testing

Tests are written using [tape](https://github.com/substack/tape)
[web-component-tester](https://github.com/Polymer/web-component-tester).

`grunt test` will run both the `tape` and `wct` tests. You'll need Chrome
installed.

## Run Tests Manually

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
or
```
wct test/polymer-ui/index.html
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
the Grunt build script.

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
