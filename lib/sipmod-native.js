'use strict';

const {U64} = require('n64');
const binding = require('./binding');

module.exports = function sipmod(data, key, m) {
  const [hi, lo] = binding.sipmod(data, key, m.hi, m.lo);
  return U64.fromBits(hi, lo);
};
