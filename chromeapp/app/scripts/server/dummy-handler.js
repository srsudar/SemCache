// A dummy handler to just write something out in response as JSON.
function DummyHandler(request) {
  WSC.BaseHandler.prototype.constructor.call(this)
}
_.extend(DummyHandler.prototype, {
  get: function() {
    chrome.storage.local.get(null, function(data) {
      this.setHeader('content-type','text/json')
      var buf = new TextEncoder('utf-8').encode(JSON.stringify({foo: 'Hello server!'})).buffer
      this.write(buf)
      this.finish()
    }.bind(this))
  }
}, WSC.BaseHandler.prototype)
