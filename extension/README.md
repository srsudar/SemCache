> SemCache Extension

# Overview

This is the code for the Chrome Extension portion of SemCache. The Extension is
responsible for saving pages and for displaying `mhtml` files. These are
permissions available to Extensions but not to Apps.

# TL;DR

Build the code:
```
grunt
```

Run the tests:
```
grunt test
```

Load the unpacked Extension from `dist/`.

# Running

The built code is checked into git and is located in the `dist/` directory.
This is a conscious decision to facilitate use even by those without the build
tools installed.

Go to `chrome://extensions`, check the `Enable Developer Mode` box in the top
right. Click `Load Unpacked Extension` and select the `dist/` directory.

Now the SemCache icon should appear in the Extension bar. Before being able to
save anything, you first need to install the Chrome App and configure it using
the settings (e.g. choosing a folder).

After this is done, clicking the Extension icon will save the currently viewed
page as `mhtml`. If you've selected `~/Desktop/semcache` as the base of the App
file system, you should see files appearing in that directory.

# Building

To build the code, first install the global tools necessary:

```
npm install -g tape
npm install -g bower
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


# Testing

Tests are written using [tape](https://github.com/substack/tape).

`grunt test` will run the tests.

You can also run the JS tests manually (note that you have to have `**` double
star globbing on in your shell):

```
tape test/scripts/**/*.js
```
