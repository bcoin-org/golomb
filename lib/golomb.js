/*!
 * golomb.js - gcs filters for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

const assert = require('assert');
const {U64} = require('n64');
const hash256 = require('bcrypto/lib/hash256');
const siphash = require('bcrypto/lib/siphash');
const BitWriter = require('./writer');
const BitReader = require('./reader');
const DUMMY = Buffer.alloc(0);
const EOF = new U64(-1);

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
    this.m = new U64(0);
    this.data = DUMMY;
  }

  hash(enc) {
    const h = hash256.digest(this.data);
    return enc === 'hex' ? h.toString('hex') : h;
  }

  header(prev) {
    return hash256.root(this.hash(), prev);
  }

  match(key, data) {
    const br = new BitReader(this.data);
    const term = siphash24(data, key).imod(this.m);

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
    assert(items.length > 0);

    const br = new BitReader(this.data);
    const last1 = new U64(0);
    const values = [];

    for (const item of items) {
      const hash = siphash24(item, key).imod(this.m);
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
    const data = Buffer.allocUnsafe(4 + this.data.length);
    data.writeUInt32BE(this.n, 0, true);
    this.data.copy(data, 4);
    return data;
  }

  toPBytes() {
    const data = Buffer.allocUnsafe(1 + this.data.length);
    data.writeUInt8(this.p, 0, true);
    this.data.copy(data, 1);
    return data;
  }

  toNPBytes() {
    const data = Buffer.allocUnsafe(5 + this.data.length);
    data.writeUInt32BE(this.n, 0, true);
    data.writeUInt8(this.p, 4, true);
    this.data.copy(data, 5);
    return data;
  }

  toRaw() {
    assert(this.p === 20);
    return this.toNBytes();
  }

  fromItems(P, key, items) {
    assert(typeof P === 'number' && isFinite(P));
    assert(P >= 0 && P <= 32);

    assert(Buffer.isBuffer(key));
    assert(key.length === 16);

    assert(Array.isArray(items));
    assert(items.length > 0);
    assert(items.length <= 0xffffffff);

    this.n = items.length;
    this.p = P;
    this.m = U64(this.n).ishln(this.p);

    const values = [];

    for (const item of items) {
      assert(Buffer.isBuffer(item));
      const hash = siphash24(item, key).imod(this.m);
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
    assert(typeof N === 'number' && isFinite(N));
    assert(typeof P === 'number' && isFinite(P));
    assert(P >= 0 && P <= 32);
    assert(Buffer.isBuffer(data));

    this.n = N;
    this.p = P;
    this.m = U64(this.n).ishln(this.p);
    this.data = data;

    return this;
  }

  fromNBytes(P, data) {
    assert(typeof P === 'number' && isFinite(P));
    assert(Buffer.isBuffer(data));
    assert(data.length >= 4);

    const N = data.readUInt32BE(0, true);

    return this.fromBytes(N, P, data.slice(4));
  }

  fromPBytes(N, data) {
    assert(typeof N === 'number' && isFinite(N));
    assert(Buffer.isBuffer(data));
    assert(data.length >= 1);

    const P = data.readUInt8(0, true);

    return this.fromBytes(N, P, data.slice(1));
  }

  fromNPBytes(data) {
    assert(Buffer.isBuffer(data));
    assert(data.length >= 5);

    const N = data.readUInt32BE(0, true);
    const P = data.readUInt8(4, true);

    return this.fromBytes(N, P, data.slice(5));
  }

  fromRaw(data) {
    return this.fromNBytes(20, data);
  }

  fromBlock(block) {
    const hash = block.hash();
    const key = hash.slice(0, 16);
    const items = [];

    for (let i = 0; i < block.txs.length; i++) {
      const tx = block.txs[i];

      if (i > 0) {
        for (const input of tx.inputs)
          items.push(input.prevout.toRaw());
      }

      for (const output of tx.outputs)
        getPushes(items, output.script);
    }

    return this.fromItems(20, key, items);
  }

  fromExtended(block) {
    const hash = block.hash();
    const key = hash.slice(0, 16);
    const items = [];

    for (let i = 0; i < block.txs.length; i++) {
      const tx = block.txs[i];

      items.push(tx.hash());

      if (i > 0) {
        for (const input of tx.inputs) {
          getWitness(items, input.witness);
          getPushes(items, input.script);
        }
      }
    }

    return this.fromItems(20, key, items);
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

  static fromBlock(block) {
    return new this().fromBlock(block);
  }

  static fromExtended(block) {
    return new this().fromExtended(block);
  }
}

/*
 * Helpers
 */

function compare(a, b) {
  return a.cmp(b);
}

function siphash24(data, key) {
  const [hi, lo] = siphash(data, key);
  return U64.fromBits(hi, lo);
}

function getPushes(items, script) {
  for (const op of script.code) {
    if (!op.data || op.data.length === 0)
      continue;

    items.push(op.data);
  }
}

function getWitness(items, witness) {
  for (const item of witness.items) {
    if (item.length === 0)
      continue;

    items.push(item);
  }
}

/*
 * Expose
 */

module.exports = Golomb;
