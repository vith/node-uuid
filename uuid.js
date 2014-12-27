//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

(function() {
  var uuid = {};

  //SECTION _rng
  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required
  var _rng;

    // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
    //
    // Moderately fast, high quality
  if (typeof(require) == 'function') {
    try {
      var _rb = require('crypto').randomBytes;
      _rng = _rb && function() {return _rb(16);};
    } catch(e) {}
    uuid._rngSource = 'node.js';
  }

  if (!_rng && crypto && crypto.getRandomValues) {
    // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
    //
    // Moderately fast, high quality
    var _rnds8 = new Uint8Array(16);
    _rng = function() {
      crypto.getRandomValues(_rnds8);
      return _rnds8;
    };
    uuid._rngSource = 'whatwg';
  }

  if (!_rng) {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var  _rnds = new Array(16);
    _rng = function() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return _rnds;
    };
    uuid._rngSource = 'Math.random';
  }
  uuid._rng = _rng;

  //SECTION _fromUUIDEpoch
  uuid._fromUUIDEpoch = function(id) {
    // Epoch conversion is tricky in JS because Numbers only have 53-bit
    // precision.  But we UUID timestamps are measured in 100-nanosecond units
    // since midnight Oct 15, 1582, meaning modern timestamps are large enough
    // to require 60 bit precision. Thus, converting to/from JS time requires
    // some number juggling.  Conceptually what we're doing is the following:
    //
    //     // uuid timestamp, measured in 100-nanosecond units
    //     var uuidTime = (id.time_hi * 0x10000 +
    //                        id.time_mid) * 0x100000000 +
    //                        id.time_low -
    //                        122192928000000000;
    //
    //     // nsecs is residual 100-nanosec units to add to JS time
    //     id.nsecs = uuidTime % 10000;
    //     // msecs is unix epoch in integer milliseconds
    //     id.msecs = (uuidTime - id.nsecs)/10000;
    //
    // ... but doing the above with no loss of precision requires (in essence)
    // doing math with the high and low 32-bits of each number separately.
    // Which looks as follows ...
    var hi = (id.time_hi * 0x10000) + id.time_mid - 0x01b21dd2;
    var remhi = hi % 10000;
    hi = (hi - remhi)/10000;

    var low = id.time_low - 0x13814000;
    var remlow = low % 10000;
    low = (low - remlow)/10000;

    var rem = remhi * 0x100000000 + remlow;
    id.nsecs = rem % 10000;

    id.msecs = hi * 0x100000000 + low;
    id.msecs += (rem - id.nsecs) / 10000;

    return id;
  };

  //SECTION _toUUIDEpoch
  uuid._toUUIDEpoch = function(id) {
    var lo = (id.msecs % 0x100000000);
    var hi = ((id.msecs - lo) / 0x100000000) * 10000 + 0x01b21dd2;
    lo = lo * 10000 + id.nsecs + 0x13814000;

    var rem = lo % 0x100000000;
    hi += (lo - rem)/0x100000000;

    if (rem < 0) {
      rem += 0x100000000;
      hi -= 0x01;
    }

    id.time_low  = rem;
    id.time_mid = hi & 0xffff;
    id.time_hi = hi >> 16;

    return id;
  };

  //SECTION validate
  var VALID_RE = new RegExp(
    '^' +                               // start of string
    '(?:urn:uuid:)?' +                  // URN prefix (optional)
    '[0-9a-fA-F]{8}' + '-' +            // time_low
    '[0-9a-fA-F]{4}' + '-' +            // time_mid
    '[1-5][0-9a-fA-F]{3}' + '-' +       // time_hi_and_version
    '[89abAB][0-9a-fA-F]{3}' + '-' +    // clk_seq_hi_res & clk_seq_low
    '[0-9a-fA-F]{12}' +                 // node
    '$'                                 // end of string
  );

  /**
   * **`validate()` - Validate the form of a uuid string**
   *
   * Returns true if the supplied string conforms to the expected format for
   * RFC uuids.  Validates number and placement of characters, as well as
   * proper values for variant and version fields
   */
  uuid.validate = function(s) {
    return VALID_RE.test(s);
  };

  //SECTION stringify
  // Map for hex value -> string conversion
  for (var i = 0, _toHex = []; i < 256; i++) {
    _toHex[i] = (i + 0x100).toString(16).substr(1);
  }
  // Public for test purposes only!  Not part of supported API.
  uuid._rng = _rng;

  /**
   * **`stringify()` - Convert uuid bytes to RFC4122-style uuid
   * string
   */
  uuid.stringify = function(bytes, offset) {
    var i = offset || 0;
    return  _toHex[bytes[i++]] + _toHex[bytes[i++]] +
    _toHex[bytes[i++]] + _toHex[bytes[i++]] + '-' +
    _toHex[bytes[i++]] + _toHex[bytes[i++]] + '-' +
    _toHex[bytes[i++]] + _toHex[bytes[i++]] + '-' +
    _toHex[bytes[i++]] + _toHex[bytes[i++]] + '-' +
    _toHex[bytes[i++]] + _toHex[bytes[i++]] +
    _toHex[bytes[i++]] + _toHex[bytes[i++]] +
    _toHex[bytes[i++]] + _toHex[bytes[i++]];
  };

  //SECTION parse
  /**
   * **`parse()` - Parse a UUID into it's component bytes**
   *
   * This is a lax parser - it produces a result for any string.
   * uuid.validate() is your friend.
   */
  uuid.parse = function(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.replace(/[0-9a-fA-F]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = parseInt(oct, 16);
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  };

  //SECTION parseFields REQUIRE validate, _fromUUIDEpoch
  /**
   * **`parseFields(id)` - parse id for semantic field information**
   *
   * `id` may be either a string or an array[16] of byte values
   *
   * Returns an object with the following properties:
   *
   *   `bytes` - `id` as byte array[16]
   *   `variant` - see RFC section 4.1.1
   *
   * When `variant` is covered by RFC4122, these are available:
   *
   *   `version` - see RFC section 4.1.3
   *
   * When `version` == 1 (timestamped ids), these are available:
   *
   *   `clockseq` - see RFC section 4.1.3
   *   `node` - see RFC section 4.1.6
   *   `time_hi` - see RFC section 4.1.2
   *   `time_low` - see RFC section 4.1.2
   *   `time_mid` - see RFC section 4.1.2
   *   `msecs` - time (Unix epoch, msec resolution)
   *   `nsecs` - time (nanosecond remainder)
   *
   *   `date` - time as JS Date object (unix epoch, msec resolution only!)
   *
   * By default the parser will throw for strings not in proper RFC format.
   * This can be disabled by passing 'true' for the 2nd argument, in which case
   * the parser will parse any JS string, using any hex octets found as input.
   */
  uuid.parseFields = function(id) {
    // Convert to bytes
    id = typeof(id) === 'string' ? uuid.parse(id) : id;

    var fields = {bytes: id, variant: id[8] & 0xe0};

    // RFC4122 only applies where variant & 0xc0 == 0x80 (sec 4.1.1)
    if (fields.variant && 0xc0 == 0x80) {
      return fields;
    }

    fields.version = id[6] >> 4 & 0xf;

    // Parse v1 fields
    if (fields.version == 1) {
      // v1 id: parse time fields


      fields.time_hi = ((id[6] & 0x0f) << 8) + id[7];
      fields.time_mid = (id[4] << 8) + id[5];
      fields.time_low = (id[0] * 0x1000000) + (id[1] << 16) + (id[2] << 8) + id[3];
      fields.clockseq = ((id[8]) & 0x3f) << 8 | id[9];
      fields.node = id.slice(10,16);
      uuid._fromUUIDEpoch(fields);

      // Time as a JS date
      fields.date = new Date(fields.msecs);
    }

    return fields;
  };

  //SECTION v1 REQUIRE _rng, stringify, _toUUIDEpoch
  /**
   * **`v1()` - Generate time-based UUID**
   *
   * Inspired by https://github.com/LiosK/UUID.js
   * and http://docs.python.org/library/uuid.html
   */

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1],
    _seedBytes[2],
    _seedBytes[3],
    _seedBytes[4],
    _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  uuid.v1 = function(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the UUID epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so time
    // is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since Unix epoch, 1970-01-01 00:00.
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

    // Timestamp fields (Per 4.1.4)
    var id = uuid._toUUIDEpoch({msecs: msecs, nsecs: nsecs});
    b[i++] = id.time_low >>> 24 & 0xff;
    b[i++] = id.time_low >>> 16 & 0xff;
    b[i++] = id.time_low >>> 8 & 0xff;
    b[i++] = id.time_low & 0xff;
    b[i++] = id.time_mid >>> 8 & 0xff;
    b[i++] = id.time_mid & 0xff;
    b[i++] = id.time_hi >>> 8 & 0xf | 0x10; // include version
    b[i++] = id.time_hi & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : uuid.stringify(b);
  };

  //SECTION v4 REQUIRE _rng, stringify
  /**
   * **`v4()` - Generate random UUID**
   */
  uuid.v4 = function(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || uuid.stringify(rnds);
  };

  //SECTION

  // Boilerplate code for publishing an object to CommonJS, AMD, or browser
  // environments.  See https://github.com/umdjs/umd
  if (typeof define === 'function' && define.amd) {
    // Publish as AMD module
    define(function() {return uuid;});
  } else if (typeof(module) != 'undefined' && module.exports) {
    // Publish as node.js module
    module.exports = uuid;
  } else {
    var _previousAPI = root.uuid;

    uuid.noConflict = function() {
      root.uuid = _previousAPI;
      return uuid;
    };

    root.uuid = uuid;
  }
}).call(this);
