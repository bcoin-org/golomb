'use strict';

const {U64} = require('n64');
const siphash = require('bcrypto/lib/siphash');
const HI = 1 / 0x100000000;

function sipmod(data, key, m) {
  const [hi, lo] = siphash(data, key);
  return reduce64(hi, lo, m.hi, m.lo);
}

// Compute `((uint128_t)a * b) >> 64`
function reduce64(ahi, alo, bhi, blo) {
  const axbhi = U64.fromInt(ahi).imuln(bhi);
  const axbmid = U64.fromInt(ahi).imuln(blo);
  const bxamid = U64.fromInt(bhi).imuln(alo);
  const axblo = U64.fromInt(alo).imuln(blo);

  // Hack:
  const c = (axbmid.lo >>> 0) + (bxamid.lo >>> 0) + (axblo.hi >>> 0);
  const m = (axbmid.hi >>> 0) + (bxamid.hi >>> 0) + ((c * HI) >>> 0);

  // More hacks:
  const mhi = (m * HI) | 0;
  const mlo = m | 0;

  return axbhi._add(mhi, mlo);
}

module.exports = sipmod;
