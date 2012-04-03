/**
 * Stutter.js
 * (c) 2012 Jay Phelps
 * MIT licensed
 * https://github.com/jayphelps/stutter.js
 */

(function (root) {
    "use strict";

    // Internal type checkers

    var toString = Object.prototype.toString;

    var isFunction = function (obj) {
        return toString.call(obj) == '[object Function]';
    };

    var isString = function (obj) {
        return toString.call(obj) == '[object String]';
    };

    // Assigned when we come across a directive and used if a StutterError
    // exception is raised 
    var currentDirectiveName;

    // Helper exception for directives
    function StutterError(message) {
        // Help them out if they didn't use "new"
        if ( !(this instanceof StutterError) ) {
            return new StutterError(message);
        }

        this.name = 'StutterError ' + Stutter.token + currentDirectiveName;
        this.message = (message || 'Houston, we have a problem. (but I wasn\'t told why)');
    }

    StutterError.prototype = new Error();
    StutterError.prototype.constructor = StutterError;

    var Stutter = {
        token: '@',
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

    // Cache references for quicker lookup
    var directives = Stutter.directives;
    var handlers = Stutter.handlers;
    var directiveRegEx;

    // Alow external changing of the directive token prefix
    Stutter.setToken = function (value) {
        Stutter.token = value;
        directiveRegEx = Stutter.directiveRegEx = new RegExp(value+'(\\S+)(.*)?');
    };

    // Set up our default token
    Stutter.setToken(Stutter.token);

    // Used to register directives both internally and externally
    Stutter.register = function (name, callback, context) {
        context = context || {};
        directives[name] = function () {
            return callback.apply(context, arguments);
        };
    };

    // Process + JS eval in one "step"
    Stutter.eval = function (source) {
        if (!source) {
            return false
        }

        var processed = Stutter.process(source);
        return eval(processed);
    };

    // WIP
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

    // Where the magic happens
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
                    // Assign current name so if an exception is thrown we know
                    // which directive it was
                    currentDirectiveName = name;

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

            // Store copy of the current line in case the variable get's tainted
            var originalLine = line;

            // Apply each of our handlers to the current line
            // in the reverse order they were added so that
            // newer handlers can have priority over older
            for (var i = handlers.length - 1; i >= 0; i--) { 
                line = handlers[i](line);
                
                // If the return value isn't a string we'll convert to
                // boolean and return the line on true else an empty string
                // on false, removing that line
                if (typeof line !== 'string') {
                    line = !!line ? originalLine : '';
                }
            };

            // Final, processed line
            return line;
        });
    
        // Final, processed source (pure JavaScript at this point..hopefully)
        return output;
    };

    /**
     * Built in directives
     */

    var defines = {};

    Stutter.register('define', function (identifier, replacement) {
        var errorToken = Stutter.token + 'define: ';
        if (!identifier) {
            throw new StutterError('Invalid define syntax');
        }

        var identifierRegEx = new RegExp(identifier, 'g');
        var replacement = this[identifier] = replacement || true;

        return function (line) {
            return line.replace(identifierRegEx, replacement);
        };
        
    }, defines);

    // FIXME: Remove endif from here and also add the rest of the conditionals
    Stutter.register('ifdef', function (identifier) {
        var errorToken = Stutter.token + 'ifdef: ';
        var endif = Stutter.token + 'endif';

        if (!identifier) {
            throw new StutterError('Invalid ifdef syntax');
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
                return false;
            }

            return isDefined;
        };
    });

    // Doesn't prevent recursive/infinite imports! (intentional at this point)
    Stutter.register('import', function (filePath) {
        var errorToken = Stutter.token + 'import: ';

        if (!filePath) {
            throw new StutterError('Missing file path');
        }
        
        // Handles single and double quote matched pairs
        // with or without the url() wrapper
        var cleanPath = filePath
            .replace(/\s*url\(\s*'([^']*)'\)/, '$1')
            .replace(/\s*url\(\s*"([^"]*)"\)/, '$1')
            .replace(/\s*'([^']*)'/, '$1')
            .replace(/\s*"([^"]*)"/, '$1');

        if (!cleanPath) {
            throw new StutterError('Invalid import url: ' + filePath);
        }

        var output;

        if (isBrowser) {
            // FIXME: add support for stupid IE...
            var request = new XMLHttpRequest();

            request.open('GET', cleanPath, false);   
            request.send(null);  

            // Check for 200 status for HTTP, but also catch if responseText
            // contains anything for local file:// access that return zero status
            if (request.status !== 200 && !request.responseText) {  
               throw new StutterError('Importing file failed: ' + filePath + ' with status code: '+request.status);
            }

            output = Stutter.process(request.responseText);

        } else {
            throw new StutterError('Non-browser use isn\'t ready yet...sorry');
        }

        return output;
        
    }, defines);

})(this);