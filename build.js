var fs = require('fs');

var PRODUCTS = [
  {name: 'uuid_parse.js', sections: /parse|publish/},
  {name: 'uuid_v1.js', sections: /stringify|random|v1|publish/},
  {name: 'uuid_v4.js', sections: /stringify|random|v4|publish/}
];

var lines = fs.readFileSync('uuid.js', 'utf-8');
lines = lines.split('\n');

PRODUCTS.forEach(function(product) {
  var include = true;
  var outLines = lines.filter(function(line) {
    if (/\/\* SECTION:/) {
      include = product.sections.test(line);
    }
    return include;
  });

  fs.writeFileSync(product.name, outLines.join('\n'));
});
