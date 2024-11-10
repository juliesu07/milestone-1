// routes/user.js
const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) { return res.status(404).json({ status: 'ERROR', error: true, message: 'User not found' }); }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) { return res.status(401).json({ status: 'ERROR', error: true, message: 'Invalid password' }); }
    if (!user.verified) { return res.status(403).json({ status: 'ERROR', error: true, message: 'Email not verified' }); }
   
    req.session.userId = user._id; // Save user ID in session
    res.status(200).json({ status: 'OK', message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: true, message: error.message });
  }

});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) { return res.status(500).json({ status: 'ERROR', error: true, message: err.message }); }
    res.status(200).json({ status: 'OK', message: 'Logout successful' });
  });
});

// Verifies if the user is currently logged in
router.post('/check-auth', (req, res) => {
    res.status(200).json({ isLoggedIn: !!req.session.userId, userId: req.session.userId || null });
});

module.exports = router;
