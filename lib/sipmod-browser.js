'use strict';

const {U64} = require('n64');
const siphash = require('bcrypto/lib/siphash');

function sipmod(data, key, m) {
  const [hi, lo] = siphash(data, key);
  return reduce(hi, lo, m.hi, m.lo);
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

  return vnphi._iaddn(khi, klo); // hack
}

module.exports = sipmod;
