/*!
 * golomb.js - gcs filters for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

const assert = require('bsert');
const {U64} = require('n64');
const hash256 = require('bcrypto/lib/hash256');
const {sipmod} = require('bcrypto/lib/siphash');
const bio = require('bufio');
const BitWriter = require('./writer');
const BitReader = require('./reader');

/*
 * Constants
 */

const DUMMY = Buffer.alloc(0);
const EOF = new U64(-1);
const M = new U64(784931);

/**
 * Golomb Filter
 */

class Golomb {
  /**
   * Create a filter.
   * @constructor
   */

  constructor() {
    this.n = 0;
    this.p = 0;
    this.m = M;
    this.data = DUMMY;
  }

  hash(enc) {
    const h = hash256.digest(this.toNBytes());
    return enc === 'hex' ? h.toString('hex') : h;
  }

  header(prev) {
    return hash256.root(this.hash(), prev);
  }

  match(key, data) {
    const br = new BitReader(this.data);
    const term = sipmod64(data, key, this.m);

    let last = new U64(0);

    while (last.lt(term)) {
      const value = this.readU64(br);

      if (value === EOF)
        return false;

      value.iadd(last);

      if (value.eq(term))
        return true;

      last = value;
    }

    return false;
  }

  matchAny(key, items) {
    const set = uniqify(items);

    assert(set.length > 0);

    const br = new BitReader(this.data);
    const last1 = new U64(0);
    const values = [];

    for (const item of set) {
      const hash = sipmod64(item, key, this.m);

      values.push(hash);
    }

    values.sort(compare);

    let last2 = values[0];
    let i = 1;

    for (;;) {
      const cmp = last1.cmp(last2);

      if (cmp === 0)
        break;

      if (cmp > 0) {
        if (i < values.length) {
          last2 = values[i];
          i += 1;
          continue;
        }
        return false;
      }

      const value = this.readU64(br);

      if (value === EOF)
        return false;

      last1.iadd(value);
    }

    return true;
  }

  readU64(br) {
    try {
      return this._readU64(br);
    } catch (e) {
      if (e.message === 'EOF')
        return EOF;
      throw e;
    }
  }

  _readU64(br) {
    const num = new U64(0);

    // Unary
    while (br.readBit())
      num.iaddn(1);

    const rem = br.readBits64(this.p);

    return num.ishln(this.p).ior(rem);
  }

  toBytes() {
    return this.data;
  }

  toNBytes() {
    const size = bio.sizeVarint(this.n) + this.data.length;
    const bw = bio.write(size);

    bw.writeVarint(this.n);
    bw.writeBytes(this.data);

    return bw.render();
  }

  toPBytes() {
    const data = Buffer.allocUnsafe(1 + this.data.length);
    data.writeUInt8(this.p, 0);
    this.data.copy(data, 1);
    return data;
  }

  toNPBytes() {
    const data = Buffer.allocUnsafe(5 + this.data.length);
    data.writeUInt32BE(this.n, 0);
    data.writeUInt8(this.p, 4);
    this.data.copy(data, 5);
    return data;
  }

  toRaw() {
    assert(this.p === 19);
    return this.toNBytes();
  }

  fromItems(P, key, items) {
    assert((P >>> 0) === P);
    assert(P >= 0 && P <= 32);
    assert(Buffer.isBuffer(key));
    assert(key.length === 16);

    const set = uniqify(items);

    assert(set.length >= 0);
    assert(set.length <= 0xffffffff);

    this.p = P;
    this.n = set.length;
    this.m = M.mul(new U64(this.n));

    const values = [];

    for (const item of set) {
      const hash = sipmod64(item, key, this.m);

      values.push(hash);
    }

    values.sort(compare);

    const bw = new BitWriter();

    let last = new U64(0);

    for (const hash of values) {
      const rem = hash.sub(last).imaskn(this.p);
      const value = hash.sub(last).isub(rem).ishrn(this.p);

      last = hash;

      // Unary
      while (!value.isZero()) {
        bw.writeBit(1);
        value.isubn(1);
      }

      bw.writeBit(0);
      bw.writeBits64(rem, this.p);
    }

    this.data = bw.render();

    return this;
  }

  fromBytes(N, P, data) {
    assert((N >>> 0) === N);
    assert((P >>> 0) === P);
    assert(P >= 0 && P <= 32);
    assert(Buffer.isBuffer(data));

    this.n = N;
    this.p = P;
    this.m = M.mul(new U64(this.n));
    this.data = data;

    return this;
  }

  fromNBytes(P, data) {
    const br = bio.read(data);
    const N = br.readVarint();
    const body = br.readBytes(br.left(), true);

    return this.fromBytes(N, P, body);
  }

  fromPBytes(N, data) {
    assert(Buffer.isBuffer(data));
    assert(data.length >= 1);

    const P = data.readUInt8(0);

    return this.fromBytes(N, P, data.slice(1));
  }

  fromNPBytes(data) {
    assert(Buffer.isBuffer(data));
    assert(data.length >= 5);

    const N = data.readUInt32BE(0);
    const P = data.readUInt8(4);

    return this.fromBytes(N, P, data.slice(5));
  }

  fromRaw(data) {
    return this.fromNBytes(19, data);
  }

  static fromItems(P, key, items) {
    return new this().fromItems(P, key, items);
  }

  static fromBytes(N, P, data) {
    return new this().fromBytes(N, P, data);
  }

  static fromNBytes(P, data) {
    return new this().fromNBytes(P, data);
  }

  static fromPBytes(N, data) {
    return new this().fromPBytes(N, data);
  }

  static fromNPBytes(data) {
    return new this().fromNPBytes(data);
  }

  static fromRaw(data) {
    return new this().fromRaw(data);
  }
}

/*
 * Helpers
 */

function sipmod64(data, key, m) {
  const [hi, lo] = sipmod(data, key, m.hi, m.lo);
  return U64.fromBits(hi, lo);
}

function compare(a, b) {
  return a.cmp(b);
}

function uniqify(items) {
  assert(Array.isArray(items));

  const set = new Set();
  const out = [];

  for (const item of items) {
    assert(Buffer.isBuffer(item));

    const str = item.toString('binary');

    if (set.has(str))
      continue;

    out.push(item);
    set.add(str);
  }

  return out;
}

/*
 * Expose
 */

module.exports = Golomb;
