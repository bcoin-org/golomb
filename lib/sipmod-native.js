'use strict';

const {U64} = require('n64');
const binding = require('./binding');

module.exports = function sipmod(data, key, mnp) {
  const [hi, lo] = binding.sipmod(data, key, mnp.hi, mnp.lo);
  return U64.fromBits(hi, lo);
};
