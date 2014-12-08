// UUIDs from https://www.uuidgenerator.net/version1
var V1 = '28c2764e-7ccf-11e4-b116-123b93f75cba'; //
var V4 = 'f59885b5-7b97-47af-ab6b-611818cfdeaf';

// This may not be in the uuid-* versions we load below, so grab it from the
// main uuid.js file here
var parseFields = require('./uuid').parseFields;

// Comparator function for sorting IDs by v1 timestamp
function compareTimes(d0, d1) {
  var f0 = parseFields(d0);
  var f1 = parseFields(d1);
  if (f0.msecs < f1.msecs) return -1;
  if (f0.msecs > f1.msecs) return 1;
  if (f0.nsecs < f1.nsecs) return -1;
  if (f0.nsecs > f1.nsecs) return 1;
  return 0;
}

exports.uuid = {
  setUp: function(done) {
    this.uuid = require('./uuid');
    done();
  },

  testEpochConversion: function(test) {
    // UUID timestamp 0x1e47f3170055f44
    // ... = new Date(1418081103748.2820)
    // ... = "Mon Dec 08 2014 15:25:03 GMT-0800 (PST)"
    var id = {
      time_hi: 0x1e4,
      time_mid: 0x7f31,
      time_low: 0x70055f44
    };

    this.uuid._fromUUIDEpoch(id);
    test.equals(id.msecs, 1418081103748);
    test.equals(id.nsecs, 2820);

    delete id.time_hi;
    delete id.time_mid;
    delete id.time_low;
    this.uuid._toUUIDEpoch(id);
    test.equals(id.time_hi, 0x1e4);
    test.equals(id.time_mid, 0x7f31);
    test.equals(id.time_low, 0x70055f44);

    // Test a bunch of timestamps to verify that our conversion between UUID
    // <-> JS epochs is symmetric.
    var i = 0, failures = 0, start = Date.now();
    while (i++ <= 0x10000000) {
      if (i % 0x10000 == 0 && Date.now() - start > 1000) break;

      // Use primes that produce a decent distribution of values
      var h = id.time_hi = (i * 769) & 0xfff;
      var m = id.time_mid = (i * 1051) & 0xfff;
      var l = id.time_low = (i * 15485863) % 0x100000000;

      this.uuid._fromUUIDEpoch(id);
      var x = {msecs: id.msecs, nsecs: id.nsecs};
      this.uuid._toUUIDEpoch(id);
      if (id.time_hi != h || id.time_mid != m || id.time_low != l) {
        failures++;
      }
    }

    test.equals(failures, 0, 'Failed ' + failures + ' of ' + i + ' ids tested');

    test.done();
  },

  testPerformance: function(test) {
    var uuid = this.uuid;

    ['v1', 'v4'].forEach(function(v) {
      var generator = this.uuid[v];
      var i = 0, n = 0;
      var start = Date.now(), end = start;
      while ((end = Date.now()) - start < 1000) {
        for (var i = 0; i < 10000; i++, n++) {
          generator();
        }
      }
      var rate = Math.round(n / (end - start) * 1000);
      console.log(v, 'perf:', rate, 'ids/second');
    }.bind(this));
    test.done();
  },

  testValidate: function(test) {
    var uuid = this.uuid;
    test.ok(uuid.validate(V1), 'Accept good id');
    test.ok(uuid.validate(V1.toUpperCase()), 'Accept uppercase id');
    test.ok(uuid.validate('urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6'),
      'Accept URN syntax');

    test.ok(!uuid.validate(V1.replace('c', '')), 'Reject missing char');
    test.ok(!uuid.validate(V1.replace('c', 'cc')), 'Reject extra char');
    test.ok(!uuid.validate(V1.replace('c', 'g')), 'Reject invalid char');
    test.ok(!uuid.validate(V1.replace('1', '6')), 'Reject invalid version ');
    test.ok(!uuid.validate(V1.replace('b', '7')), 'Reject invalid variant');

    test.done();
  },

  testParse: function(test) {
    var uuid = this.uuid;
    var EXPECTED = [
      0x28, 0xc2, 0x76, 0x4e, 0x7c, 0xcf, 0x11, 0xe4,
      0xb1, 0x16, 0x12, 0x3b, 0x93, 0xf7, 0x5c, 0xba
    ];

    // string -> byte array
    test.deepEqual(uuid.parse(V1), EXPECTED, 'Parses valid id');

    var dirtyV1 = V1.replace(/^/, 'text at the start')
    .replace('-', ':"AGAG{}|')
    .replace('-', '%$#@!%!$')
    .replace('-', '----')
    .replace(/$/, 'text at the end');
    test.deepEqual(uuid.parse(dirtyV1), EXPECTED, 'Works with sloppy input');

    test.done();
  },

  testStringify: function(test) {
    var uuid = this.uuid;
    test.equal(uuid.stringify(uuid.parse(V1)), V1);

    test.done();
  },

  testParseFields: function(test) {
    var uuid = this.uuid;

    // Insure parseFields() and v1() use compatible structures
    test.equal(V1, uuid.v1(uuid.parseFields(V1)));

    // string -> fields
    var fields = uuid.parseFields(V1);
    test.deepEqual(fields, {
      bytes: uuid.parse(V1),
      variant: 0xa0,
      version: 1,
      time_hi: 0x1e4,
      time_mid: 0x7ccf,
      time_low: 0x28c2764e,
      msecs: 1417818991186,
      nsecs: 4910,
      clockseq: 0x3116,
      node: [0x12, 0x3b, 0x93, 0xf7, 0x5c, 0xba],
      date: new Date(13637111791186 - 12219292800000)
    });

    test.done();
  },

  testV1: function(test) {
    var uuid = this.uuid;
    var TIME = 1321644961388; // 2011-11-18 11:36:01.388-08:00

    test.equal(parseFields(uuid.v1()).version, 1, 'version == 1');

    test.equal(
      uuid.v1({
        msecs: 1321651533573, // Fri Nov 18 2011 13:25:33 GMT-0800 (PST)
        nsecs: 5432,
        clockseq: 0x385c,
        node: [ 0x61, 0xcd, 0x3c, 0xbb, 0x32, 0x10 ]
      }),
      'd9428888-122b-11e1-b85c-61cd3cbb3210',
      'Explicit options produce expected id'
    );

    test.notEqual(uuid.v1({msecs: TIME}), uuid.v1({msecs: TIME}),
      'IDs created at same msec are different'
    );

    test.throws(function() {uuid.v1({msecs: TIME, nsecs: 10000});},
      'Exception thrown when > 10K ids created in 1 ms');

    var fields0 = parseFields(uuid.v1({msecs: TIME}));
    var fields1 = parseFields(uuid.v1({msecs: TIME - 1}));
    test.equal(fields1.clockseq - fields0.clockseq, 1,
      'Clock regression bumps clockseq');

    var u0 = uuid.v1({msecs: TIME, nsecs: 9999});
    var u1 = uuid.v1({msecs: TIME + 1, nsecs: 0});
    // Note: we rely on the fact parseInt stops at the first '-', i.e. we're
    // actually only looking at the time_low field.
    test.equal(parseInt(u1, 16) - parseInt(u0, 16), 1,
      'Ids spanning 1ms boundary are 100ns apart');

    // Test explicit times
    var pre = [
      uuid.v1({msecs: TIME - 10*3600*1000}),
      uuid.v1({msecs: TIME - 1}),
      uuid.v1({msecs: TIME}),
      uuid.v1({msecs: TIME + 1}),
      uuid.v1({msecs: TIME + 28*24*3600*1000})
    ];
    var post = [].concat(pre);
    post.sort(compareTimes);
    test.deepEqual(pre, post, 'compareTimes() works');

    pre = [uuid.v1(), uuid.v1(), uuid.v1(), uuid.v1(), uuid.v1()];
    post = [].concat(pre);
    post.sort(compareTimes);
    test.deepEqual(pre, post, 'Ids are time ordered');

    test.done();
  },

  testV4: function(test) {
    var uuid = this.uuid;
    test.equal(parseFields(uuid.v4()).version, 4, 'version == 4');

    test.done();
  }
};

// Test v1() in `uuid-v1.js`
exports['uuid-v1'] =  {
  setUp: function(done) {
    this.uuid = require('./uuid-v1');
    done();
  },
  testV1: exports.uuid.testV1
};

// Test v4() in `uuid-v4.js`
exports['uuid-v4'] =  {
  setUp: function(done) {
    this.uuid = require('./uuid-v4');
    done();
  },
  testV4: exports.uuid.testV4
};
