'use strict';

const siphash = require('bcrypto/lib/siphash');
const {U64} = require('n64');

function sipmod(data, key, m) {
  const [hi, lo] = siphash(data, key);
  const hash = U64.fromBits(hi, lo);
  return reduce(hash.hi, hash.lo, m.hi, m.lo);
}

function reduce(vhi, vlo, nhi, nlo) {
  const vnphi = new U64(vhi).imuln(nhi);
  const vnpmid = new U64(vhi).imuln(nlo);
  const npvmid = new U64(nhi).imuln(vlo);
  const vnplo = new U64(vlo).imuln(nlo);

  const c = (vnpmid.lo + npvmid.lo + vnplo.hi) * (1 / 0x100000000);
  const k = (vnpmid.hi >>> 0) + (npvmid.hi >>> 0) + (c >>> 0);

  const khi = (k * (1 / 0x100000000)) | 0;
  const klo = k | 0;

  return vnphi.iadd(khi).iadd(klo);
}

module.exports = sipmod;
