// UUIDs from https://www.uuidgenerator.net/version1
var V1 = '28c2764e-7ccf-11e4-b116-123b93f75cba';
var V4 = 'f59885b5-7b97-47af-ab6b-611818cfdeaf';

var parseFields = require('./uuid').parseFields;

function compareTimes(d0, d1) {
  var f0 = parseFields(d0);
  var f1 = parseFields(d1);
  if (f0.time_msecs < f1.time_msecs) return -1;
  if (f0.time_msecs > f1.time_msecs) return 1;
  if (f0.time_nsecs < f1.time_nsecs) return -1;
  if (f0.time_nsecs > f1.time_nsecs) return 1;
  return 0;
}

var TESTS = {
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
    // string -> fields
    var fields = uuid.parseFields(V1);
    test.deepEqual(fields, {
      bytes: uuid.parse(V1),
      variant: 0xa0,
      version: 1,
      time_hi: 0x1e4,
      time_mid: 0x7ccf,
      time_low: 0x28c2764e,
      time_msecs: 13637111791186,
      time_nsecs: 0.49021874999743886,
      clockseq: 0x3116,
      node: 0x123b93f75cba,
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

// Run all tests against `uuid.js`
exports.fullBuild = {};
Object.keys(TESTS).forEach(function(test) {
  exports.fullBuild[test] = TESTS[test];
});
exports.fullBuild.setUp = function(done) {
    this.uuid = require('./uuid');
    done();
};

// Test v1() in `uuid-v1.js`
exports.v1Build =  {
  setUp: function(done) {
    this.uuid = require('./uuid-v1');
    done();
  },
  testV1: TESTS.testV1
};

// Test v4() in `uuid-v4.js`
exports.v4Build =  {
  setUp: function(done) {
    this.uuid = require('./uuid-v4');
    done();
  },
  testV4: TESTS.testV4
};
