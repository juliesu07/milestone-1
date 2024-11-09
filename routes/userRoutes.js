// routes/user.js
const express = require('express');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const router = express.Router();

// Mail configuration
const { smtpConfig } = require('../config/mailConfig');
const transporter = nodemailer.createTransport(smtpConfig);

const checkSession = (req, res, next) => {
    if (req.session) {
        next(); // User is authenticated, proceed to the next middleware or route handler
    } else {
        return res.status(200).json({
            status: "ERROR",
            error: true,
            message: "Not logged in"
        });
    }
};

// Add user
router.post('/adduser', async (req, res) => {
  console.log('Request Body:', req.body);

  try {
    const { username, password, email } = req.body;
    console.log('Email being used:', email); // Log the email for debugging purposes

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(200).json({ status: 'ERROR', error:true, message: 'User already exists' });
    }

    // Create a new user
    const user = new User({ username, password, email });
    await user.save();

    // Send verification email
    const verificationKey = Buffer.from(email).toString('base64'); // Simple encoding for verification
    const verifyLink = `http://jaws.cse356.compas.cs.stonybrook.edu/api/verify?email=${encodeURIComponent(email)}&key=${verificationKey}`;

    // Attempt to send the email
    const mailOptions = {
      from: 'noreply@jaws.cse356.compas.cs.stonybrook.edu',
      to: email,
      subject: 'Email Verification',
      text: `Please verify your email by clicking the link: ${verifyLink}`
    };

    // Sending email
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error); // Log the error
        return res.status(200).json({ status: 'ERROR', error:true, message: 'Failed to send verification email.' });
      }
      console.log('Email sent:', info.response); // Log success
    });
    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('Error occurred during user creation:', error); // Log the error
    res.status(200).json({ status: 'ERROR', error:true, message: error.message });
  }
});

// Verify user
router.get('/verify', async (req, res) => {
  console.log(req.query);
  const { email, key } = req.query;
  console.log("pass");
  const decodedEmail = Buffer.from(key, 'base64').toString('utf-8');

  if (decodedEmail !== email) {
    return res.status(200).json({ status: 'ERROR', error:true, message: 'Invalid verification link' });
  }

  try {
    await User.updateOne({ email }, { verified: true });
    res.status(200).json({ status: 'OK', message: 'Email verified successfully' });
  } catch (error) {
    res.status(200).json({ status: 'ERROR', error:true, message: error.message });
  }
});

router.get('/session', async (req, res) => {
  if (req.session && req.session.userId) {
    const user = await User.findById(req.session.userId);

    if (!user) {
        return res.status(200).json({ status: 'ERROR', error:true, message: "not user" });
    }
    return res.status(200).json({ status: 'OK', username: user.username });
  } else {
    return res.status(200).json({ status: 'ERROR', error:true, message: 'No active session' });
  }
});

module.exports = router;
