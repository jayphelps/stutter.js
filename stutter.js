/**
 * Stutter.js
 * (c) 2012 Jay Phelps
 * MIT licensed
 * https://github.com/jayphelps/stutter.js
 */

(function (window) {

	// Internal function type checker for handlers
	var toString = Object.prototype.toString;
	var isFunction = function (obj) {
		return toString.call(obj) == '[object Function]';
	};

	var Stutter = {
		prefix: '@',
		directives: {},
		handlers: [],
		directiveRegEx: null,
		expandNewlineEscapes: true
	};

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
					// Call the defined handler generator
					var handler = handlerGenerator(expression);

					// Makes sure handler is a function
					if ( handler && isFunction(handler) ) {
						// Add it to our existing handlers
						handlers.push(handler);
						// Return empty string so this line is replaced and
						// we move onto the next one
						return '';
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

	Stutter.register('ifdef', function (expression) {
		var endif = Stutter.prefix+'endif';
		var parts = expression.match(/([a-zA-Z0-9_]+)/);

		if (!parts) {
			throw Error('Invalid ifdef syntax');
		}

		var identifier = parts[1];
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

	window.Stutter = Stutter;

})(window);