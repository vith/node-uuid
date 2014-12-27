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
