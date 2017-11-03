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

/*
// Without n64:
// Compute `((uint128_t)a * b) >> 64`
function reduce64(ahi, alo, bhi, blo) {
  const axbhi = mul64(ahi, bhi);
  const axbmid = mul64(ahi, blo);
  const bxamid = mul64(bhi, alo);
  const axblo = mul64(alo, blo);

  // Hack:
  const c = (axbmid.lo >>> 0) + (bxamid.lo >>> 0) + (axblo.hi >>> 0);
  const m = (axbmid.hi >>> 0) + (bxamid.hi >>> 0) + ((c * HI) >>> 0);

  // More hacks:
  const mhi = (m * HI) | 0;
  const mlo = m | 0;

  const {hi, lo} = add64(axbhi.hi, axbhi.lo, mhi, mlo);

  return U64.fromBits(hi, lo);
}

function add64(ahi, alo, bhi, blo) {
  // Credit to @indutny for this method.
  const lo = (alo + blo) | 0;

  const s = lo >> 31;
  const as = alo >> 31;
  const bs = blo >> 31;

  const c = ((as & bs) | (~s & (as ^ bs))) & 1;

  const hi = (((ahi + bhi) | 0) + c) | 0;

  return { hi, lo };
}

function mul64(alo, blo) {
  const a16 = alo >>> 16;
  const a00 = alo & 0xffff;

  const b16 = blo >>> 16;
  const b00 = blo & 0xffff;

  let c48 = 0;
  let c32 = 0;
  let c16 = 0;
  let c00 = 0;

  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xffff;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xffff;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xffff;
  c48 += c32 >>> 16;
  c32 &= 0xffff;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xffff;
  c48 += c32 >>> 16;
  c48 &= 0xffff;

  const hi = (c48 << 16) | c32;
  const lo = (c16 << 16) | c00;

  return { hi, lo };
}
*/

module.exports = sipmod;
