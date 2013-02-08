// @License
// uuid.js
// Copyright (c) 2010-2012 Robert Kieffer
// MIT License - http://opensource.org/licenses/mit-license.php

(function (root) {
  // The public API to export (a.k.a. module.exports)
  var api = {};

  /* SECTION stringify */

  // One-off map of value -> hex string
  for (var i = 0, toHex = []; i < 256; i++) {
    toHex[i] = (i + 0x100).toString(16).substr(1);
  }

  // **`stringify()` - Convert array of uuid bytes into RFC4122-style uuid string
  function stringify(arr, offset) {
    offset  = offset || 0;
    return  toHex[arr[offset++]] + toHex[arr[offset++]] +
            toHex[arr[offset++]] + toHex[arr[offset++]] + '-' +
            toHex[arr[offset++]] + toHex[arr[offset++]] + '-' +
            toHex[arr[offset++]] + toHex[arr[offset++]] + '-' +
            toHex[arr[offset++]] + toHex[arr[offset++]] + '-' +
            toHex[arr[offset++]] + toHex[arr[offset++]] +
            toHex[arr[offset++]] + toHex[arr[offset++]] +
            toHex[arr[offset++]] + toHex[arr[offset++]];
  }

  api.stringify = stringify;

  /* SECTION random */

  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required

  var getRandomBytes;

  if (typeof(require) == 'function') {
    // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
    //
    // Moderately fast, high quality
    try {
      var _rb = require('crypto').randomBytes;
      getRandomBytes = _rb && function() {
        return _rb(16);
      };
    } catch(e) {}
  }

  if (!getRandomBytes && typeof('crypto') == 'object' && crypto.getRandomValues) {
    // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
    //
    // Moderately fast, high quality
    var _rnds8 = new Uint8Array(16);
    getRandomBytes = function() {
      crypto.getRandomValues(_rnds8);
      return _rnds8;
    };
  }

  if (!getRandomBytes) {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var  _rnds = new Array(16);
    getRandomBytes = function() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return _rnds;
    };
  }

  api.getRandomBytes = getRandomBytes;

  /* SECTION v1 REQUIRES stringify, random */

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = getRandomBytes();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : stringify(b);
  }

  api.v1 = v1;

  /* SECTION v4 REQUIRES stringify, random */

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    options = options || {};

    var rnds = options.random || (options.rng || getRandomBytes)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || stringify(rnds);
  }

  api.v4 = v4;

  /* SECTION parse */

  // Regex for identifying valid RFC4122 UUIDs
  var VALID_RE = new RegExp(
    '^\\s*' +                 // leading whitespace (optional)
    '(?:urn:uuid:)?' +        // URN prefix (optional)
    '[0-9a-fA-F]{8}' + '-' +  // time_low
    '[0-9a-fA-F]{4}' + '-' +  // time_mid
    '[1-5][0-9a-fA-F]{3}' + '-' + // time_hi_and_version
    '[89abAB][0-9a-fA-F]{3}' + '-' + // clk_seq_hi_res & clk_seq_low
    '[0-9a-fA-F]{12}' +       // node
    '\\s*$'                   // trailing whitespace (optional)
  );

  // **`validate()` - A basic UUID format checker**
  //
  // Validate a string as being in RFC4122 UUID string representation (see RFC
  // section 3)
  function validate(s) {
    return VALID_RE.test(s);
  }

  // **`parse()` - Parse a RFC4122 UUID string**
  //
  // Returns an object with the following properties:
  //
  // * timestamp - 1-msec units, unix epoch
  // * version - see RFC section 4.1.3
  // * variant - see RFC section 4.1.1
  // * clockSeq - see RFC section 4.1.3
  // * node - see RFC section 4.1.6
  // * bytes - parsed byte values
  //
  // By default the parser will throw for strings not in proper RFC format.
  // This can be disabled by passing 'true' for the 2nd argument, in which case
  // the parser will parse any JS string, using any hex octets found as input.
  function parse(s, nonstrict) {
    if (!nonstrict && !validate(s)) {
      throw new Error('Invalid RFC4122 UUID');
    }

    // Extract hex octets (pairs of hex digits)
    var b = s.match(/[0-9a-fA-F]{2}/g) || [];
    for (var i = 0; i < b.length; i++) {
      b[i] = parseInt(b[i], 16);
    }

    // Get timestamp fields
    var time_low = (b[0] * 0x1000000) + (b[1] << 16) + (b[2] << 8) + b[3];
    var time_mid = (b[4] << 8) + b[5];
    var time_hi = ((b[6] & 0x0f) << 8) + b[7];

    // Convert timestamp to msecs+nsecs since unix epoch
    var _thm = (time_hi * 0x10000 + time_mid) / 10000 * 0x100000000;
    var _tl = time_low / 10000;
    time_msecs = Math.floor(_thm + _tl);
    time_nsecs = _thm - time_msecs + _tl;
    time_msecs -= 12219292800000; // msecs between gregoriean -> unix epochs

    var o = {
      bytes: b,

      time_hi:    time_hi,
      time_mid:   time_mid,
      time_low:   time_low,

      time_msecs: time_msecs,
      time_nsecs: time_nsecs,

      version:    (b[6] & 0xf0) >>> 4,

      variant:    b[8] & 0xc0,

      clockseq:   (((b[8]) & 0x3f) << 8) | b[9],

      node:       ((b[10] << 16) + (b[11] << 8) + b[12]) * 0x1000000 +
                  (b[13] << 16) + (b[14] << 8) + b[15]
    };

    return o;
  }

  api.VALID_RE = VALID_RE;
  api.validate = validate;
  api.parse = parse;

  /* SECTION */

  // Boilerplate code for publishing an object to CommonJS, AMD, or browser
  // environments.  See https://github.com/umdjs/umd
  if (typeof exports === 'object') {
    module.exports = api;
  } else if (typeof define === 'function' && define.amd) {
    define(function() {return api;});
  } else {
    var _previousAPI = root.uuid;

    api.noConflict = function() {
      root.uuid = _previousAPI;
      return api;
    };

    root.uuid = api;
  }
}(this));
