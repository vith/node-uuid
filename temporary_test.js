var uuid = require('./uuid');

function dump(id) {
  var fields = uuid.parse(id);
  delete fields.bytes;
  fields.time_hi = fields.time_hi.toString(16);
  fields.time_mid = fields.time_mid.toString(16);
  fields.time_low = fields.time_low.toString(16);
  console.log(fields);
}


dump('e7a69041-b412-11e2-ad2c-57e3dd379c2d');
console.log('---');
dump('e7a69040-b412-11e2-ad2c-57e3dd379c2d');
console.log('---');
dump('e7a6b750-b412-11e2-ad2c-57e3dd379c2d');
console.log('---');
