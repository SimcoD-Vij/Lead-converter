"use strict";

var sanitize = function sanitize() {
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  return String(str).trim();
};

module.exports = {
  sanitize: sanitize
};