'use strict';

const {U64} = require('n64');
const siphash = require('bcrypto/lib/siphash');

function sipmod(data, key, m) {
  const [hi, lo] = siphash(data, key);
  return reduce64(hi, lo, m.hi, m.lo);
}

// Compute `(uint64_t)((uint128_t)a * (uint128_t)b) >> 64`
function reduce64(ahi, alo, bhi, blo) {
  const axbhi = new U64(ahi).imuln(bhi);
  const axbmid = new U64(ahi).imuln(blo);
  const bxamid = new U64(bhi).imuln(alo);
  const axblo = new U64(alo).imuln(blo);

  // Hack:
  const c = (axbmid.lo + bxamid.lo + axblo.hi) * (1 / 0x100000000);
  const m = (axbmid.hi >>> 0) + (bxamid.hi >>> 0) + (c >>> 0);

  // More hacks:
  const mhi = (m * (1 / 0x100000000)) | 0;
  const mlo = m | 0;

  return axbhi._add(mhi, mlo);
}

module.exports = sipmod;
