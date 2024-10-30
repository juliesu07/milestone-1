// config/mailConfig.js
module.exports = {
  smtpConfig: {
    host: 'jaws.cse356.compas.cs.stonybrook.edu',
    port: 25, // or 25 depending on your setup
    secure: false, // true for 465, false for other ports
    auth: {
      user: null, // Your SMTP username
      pass: null, // Your SMTP password
    },
  tls: {
      rejectUnauthorized: false, // Only for development; be cautious in production
    },
  },
};
