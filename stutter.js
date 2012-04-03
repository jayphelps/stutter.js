/**
 * Stutter.js
 * (c) 2012 Jay Phelps
 * MIT licensed
 * https://github.com/jayphelps/stutter.js
 */

(function () {
    var root  = this;

    // Internal function type checker for handlers
    var toString = Object.prototype.toString;

    var isFunction = function (obj) {
        return toString.call(obj) == '[object Function]';
    };

    var isString = function (obj) {
        return toString.call(obj) == '[object String]';
    };

    var Stutter = {
        prefix: '@',
        directives: {},
        handlers: [],
        directiveRegEx: null,
        expandNewlineEscapes: true
    };

    var isBrowser;

    // CommonJS || Browser
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = Stutter;
        }
        exports.Stutter = Stutter;
        isBrowser = false;
    } else {
        root['Stutter'] = Stutter;
        isBrowser = true;
    }

    var directives = Stutter.directives;
    var handlers = Stutter.handlers;
    var directiveRegEx;

    Stutter.setPrefix = function (value) {
        Stutter.prefix = value;
        directiveRegEx = Stutter.directiveRegEx = new RegExp(value+'(\\S+)(.*)?');
    };

    Stutter.setPrefix(Stutter.prefix);

    Stutter.register = function (name, callback, context) {
        context = context || {};
        directives[name] = function () {
            return callback.apply(context, arguments);
        };
    };

    Stutter.eval = function (source) {
        if (!source) {
            return false
        }

        var processed = Stutter.process(source);
        return eval(processed);
    };

    Stutter.run = function () {
        var scripts = document.getElementsByTagName('script');

        for (var i = 0, l = scripts.length; i < l; i++) {
            switch (scripts[i].type) {
                case 'text/sutter':
                case 'application/stutter':
                    var currentScript = scripts[i];

                    if (currentScript.src) {
                        // Add code to XMLHttpRequest the source
                    } else {
                        var source = currentScript.innerHTML || currentScript.text;
                        Stutter.eval(source);
                    }
                    break;
            }
        }
    };

    Stutter.process = function (source) {
        if (Stutter.expandNewlineEscapes) {
            // Expands newline escapes so they are passed along to handlers.
            source = source.replace(/\\\n/g, '');
        }
        
        // Go through the source line-by-line
        var output = source.replace(/(.*)\n/g, function (line) {
            // Check if the line looks like it might be a directive
            var match = line.match(directiveRegEx);

            if (match) {
                var name = match[1];
                // Now confirm if a handler exists
                var handlerGenerator = directives[name];

                if (handlerGenerator) {
                    var expression = match[2];
                    var parts = expression.match(/([\S]+)(?:[ \t]+(.+))?/);

                    // Call the defined handler generator
                    var handler = handlerGenerator(parts[1], parts[2], expression);

                    if (handler) {
                        // Makes sure handler is a function
                        if ( isFunction(handler) ) {
                            // Add it to our existing handlers
                            handlers.push(handler);
                            // Return empty string so this line is replaced and
                            // we move onto the next one
                            return '';
                        } else if ( isString(handler) ) {
                            return handler;
                        }
                    }
                }
            }

            // Apply each of our handlers to the current line
            // in the reverse order they were added so that
            // newer handlers can have priority over older
            for (var i = handlers.length - 1; i >= 0; i--) { 
                line = handlers[i](line);
                // Just in case the handler doesn't return a string
                if (typeof line !== 'string') {
                    line = '';
                }
            };

            return line;
        });

        return output;
    };

    /**
     * Built in directives
     */

    var defines = {};

    Stutter.register('define', function (identifier, replacement) {

        if (!identifier) {
            throw Error('Invalid define syntax');
        }

        var identifierRegEx = new RegExp(identifier, 'g');
        var replacement = this[identifier] = replacement || true;

        return function (line) {
            return line.replace(identifierRegEx, replacement);
        };
        
    }, defines);

    Stutter.register('ifdef', function (identifier) {
        var endif = Stutter.prefix+'endif';

        if (!identifier) {
            throw Error('Invalid ifdef syntax');
        }

        var isDefined = !!defines[identifier];
        var hasReachedEndIf = false;

        return function (line) {
            // Keep these three separate!
            if (hasReachedEndIf) {
                return line;
            }

            if (line.match(endif)) {
                hasReachedEndIf = true;
                return '';
            }

            if (isDefined) {
                return line;
            }

            return '';
        };
    });

    // Doesn't prevent recursive/infinite imports yet!
    Stutter.register('import', function (filePath) {
        var errorPrefix = '@import: ';

        if (!filePath) {
            throw Error(errorPrefix + 'Missing file path');
        }
        
        // Handles single and double quote matched pairs
        // with or without the url() wrapper
        cleanPath = filePath
            .replace(/\s*url\(\s*'([^']*)'\)/, '$1')
            .replace(/\s*url\(\s*"([^"]*)"\)/, '$1')
            .replace(/\s*'([^']*)'/, '$1')
            .replace(/\s*"([^"]*)"/, '$1');

        if (!cleanPath) {
            throw Error(errorPrefix + 'Invalid import url: ' + filePath);
        }

        var output;

        if (isBrowser) {
            var request = new XMLHttpRequest();

            request.open('GET', cleanPath, false);   
            request.send(null);  

            // Check for 200 status for HTTP, but also catch if responseText
            // contains anything for local file:// access that return zero status
            if (request.status !== 200 && !request.responseText) {  
                throw Error(errorPrefix + 'Importing file failed: ' + filePath + ' with status code: '+request.status);
            }

            output = Stutter.process(request.responseText);

        } else {
            throw Error('Non-browser use of @import isn\'t ready yet...sorry');
        }

        return output;
        
    }, defines);

})();