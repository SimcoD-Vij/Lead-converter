const sanitize = (str = '') => {
    return String(str).trim();
  };
  
  module.exports = { sanitize };