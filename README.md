Stutter.js
======

JavaScript preprocessor library. Easily add your own directives to make your code more reusable and maintainable. (or abuse them and destroy your code...if you wish!)

Getting Started
---------------

I'll be documenting usage shortly. Still very much a work in progress.

### Registering your own directive

``` javascript
var defines = {};

Stutter.register('define', function (identifier, replacement, rawLine) {

  if (!identifier) {
    throw Error('Invalid define syntax');
  }

  var identifierRegEx = new RegExp(identifier, 'g');
  var replacement = this[identifier] = replacement || true;

  return function (line) {
    return line.replace(identifierRegEx, replacement);
  };
  
}, defines);
```

### Use it

```
@define MESSAGE 'hello world'
alert(MESSAGE);
```

### Abuse it

```
@define ALERT_HELLO (function (msg) { \
  alert('hello ' + msg);              \
})

ALERT_HELLO('world');
```

### Process it

* String-to-String

``` javascript
var newCode = Stutter.process(oldCode);
```

* String-to-Execute

``` javascript
Stutter.eval(sourceCode);
```

* Execute all script tags with type set as "application/stutter" or "text/stutter"

``` javascript
Stutter.run();
```

License
------------

MIT Licensed
http://www.opensource.org/licenses/mit-license.php