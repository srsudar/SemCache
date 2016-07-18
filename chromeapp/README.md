> SemCache

# Overview

This is the code for the Chrome App portion of SemCache. The app is responsible
for interacting with the file system and sockets--permissions that are
available to Chrome Apps but not to Chrome extensions.


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
