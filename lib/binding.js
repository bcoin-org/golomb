'use strict';

if (process.env.NODE_BACKEND && process.env.NODE_BACKEND !== 'native')
  throw new Error('Native backend not selected.');

module.exports = require('bindings')('golomb');
