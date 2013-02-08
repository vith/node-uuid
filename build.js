#!/usr/bin/env node
// @license
// Copyright (c) 2010-2012 Robert Kieffer
// MIT License - http://opensource.org/licenses/mit-license.php

/*
Generate one or more optimized versions of a JS script.

Produces output files for each of the defined PRODUCTS (below), by removing any
SECTIONs that aren't required, and minifying the result.

This is a bit ad-hoc, but it's the best(?) solution currently available for providing a runnable development file, while providing a reasonable set of options for developers that want to minimize bytes-over-the-wire in production.

Usage: node build.js
*/

var fs = require('fs');
var UglifyJS = require('uglify-js2');

// Read config file
if (process.argv.length != 3) {
  console.log("Usage: node build.js [config file]");
  process.exit();
}
var PRODUCTS = JSON.parse(fs.readFileSync(process.argv.pop()));

// Regex for detecting "SECTION" lines
var SECTION_RE = /\/\*\s*SECTION\s+(?:(\w+)(?:\s+REQUIRES\s+([\w, ]*))?)?/;

function generateProduct(product) {
  console.log('Generating', product.output);

  // Read input file
  var source = fs.readFileSync(product.input, 'utf8').split('\n');

  // Build dependency map
  var dependencies = {};
  source.forEach(function(line) {
    if (SECTION_RE.test(line)) {
      var name = RegExp.$1;
      var depends = RegExp.$2 && RegExp.$2.match(/\w+/g) || [];
      depends.unshift();
      dependencies[name] = depends;
    }
  });

  // Build a map of all dependencies required by section
  var buildRequires = function(map, section) {
    var seen = map[section];
    map[section] = true;
    if (!seen && dependencies[section]) {
      dependencies[section].forEach(function(name) {
        map[name] = true;
        buildRequires(map, name);
      });
    }
    return map;
  };

  var requires = product.requires.reduce(buildRequires, {});

  // Include only the specified sections of source
  var include = true;
  var outSource = source.filter(function(line) {
    var isDeclaration = SECTION_RE.test(line);
    var section = RegExp.$1;
    if (isDeclaration) {
      include = !section || requires[section];
    }
    return include;
  });

  var ast = UglifyJS.parse(outSource.join('\n'));

  // Mangle names
  ast.figure_out_scope();

  /* For additional compression?  have not tested this(!)
  compressor = UglifyJS.Compressor();
  ast = ast.transform(compressor);
  */

  ast.compute_char_frequency();
  ast.mangle_names();

 var stream = UglifyJS.OutputStream({
   /* uncomment for slightly-more debuggable code
   beautify      : true, // beautify output?
   bracketize    : true, // use brackets every time?
   comments      : true, // output comments?
   indent_level  : 2,     // indentation level (only when `beautify`)
   */
 });
  ast.print(stream);
  fs.writeFileSync(product.output, stream.toString(), 'utf8');
}

// Build each output product
PRODUCTS.forEach(generateProduct);

console.log('done');
