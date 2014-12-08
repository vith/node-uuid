// AUTO-GENERATED - DO NOT EDIT

//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

(function() {
  var uuid = {};

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

  // Map for hex value -> string conversion
  for (var i = 0, _toHex = []; i < 256; i++) {
    _toHex[i] = (i + 0x100).toString(16).substr(1);
  }

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
