'use strict';

try {
  module.exports = require('./sipmod-native');
} catch (e) {
  module.exports = require('./sipmod-browser');
}
