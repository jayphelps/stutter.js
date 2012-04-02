Stutter.js
======

JavaScript preprocessor library. Easily add your own directives to make your code more reusable and maintainable. (or abuse them and destroy your code...if you wish!)

Getting Started
---------------

I'll be documenting usage shortly. Still very much a work in progress.

### Registering your own directive

``` javascript
Stutter.register('define', function (expression) {
  var parts = expression.match(/([a-zA-Z0-9_]+)(?:[ \t]+(.+))?/);

  if (!parts) {
    throw Error('Invalid define syntax');
  }
  
  var identifier = parts[1];
  var identifierRegEx = new RegExp(identifier, 'g');
  var replacement = this[identifier] = parts[2] || true;

  return function (line) {
    return line.replace(identifierRegEx, replacement);
  };
    
}, defines);
```

### Processing source

``` javascript
var newCode = Stutter.process(originalCode);
```

### Use it

``` javascript
@define MESSAGE 'hello world'
alert(MESSAGE);
```

### Abuse it

``` javascript
@define ALERT_HELLO function (msg) { \
  alert(msg);                        \
}

(ALERT_HELLO)('hello world');
```

License
------------

MIT Licensed
http://www.opensource.org/licenses/mit-license.php