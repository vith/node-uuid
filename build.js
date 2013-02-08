#!/usr/bin/env node
// @license
// Copyright (c) 2010-2012 Robert Kieffer
// MIT License - http://opensource.org/licenses/mit-license.php

/*
Generate one or more optimized versions of a JS script.

Produces output files for each of the products defined in the input [JSON]
file.  Transformations include removal of any unrequired SECTIONs and Uglify-based minification.

This is a bit ad-hoc, and not particularly efficient, but it does what we're
with a minimum of complexity.

Usage: node build.js (config_file)
*/

var fs = require('fs');
var UglifyJS = require('uglify-js2');

// Read config file
if (process.argv.length != 3) {
  console.log("Usage: node build.js [config file]");
  process.exit();
}
var config = JSON.parse(fs.readFileSync(process.argv.pop()));

// Regex for detecting "SECTION" lines
var SECTION_RE = /\/\*\s*SECTION\s+(?:(\w+)(?:\s+REQUIRES\s+([\w, ]*))?)?/;

function generateProduct(product) {
  console.log('Generating', product.output);

  // Read input file
  var source = fs.readFileSync(product.input, 'utf8').split('\n');

  // Build map of dependencies declared by sections
  var dependencies = {};
  source.forEach(function(line) {
    if (SECTION_RE.test(line)) {
      var name = RegExp.$1;
      var depends = RegExp.$2 && RegExp.$2.match(/\w+/g) || [];
      depends.unshift();
      dependencies[name] = depends;
    }
  });

  // Build [flattened] map of product dependencies
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
  var productMap = product.requires.reduce(buildRequires, {});

  // Filter out unrequired sections
  var include = true;
  var outSource = source.filter(function(line) {
    var isDeclaration = SECTION_RE.test(line);
    var section = RegExp.$1;
    if (isDeclaration) {
      include = !section || productMap[section];
    }
    return include;
  });

  // Transform
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
   /* debugging minified code may be a bit easier with these options
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
config.forEach(generateProduct);

console.log('done');
