// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
var Schema = mongoose.Schema;

const userSchema = Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  verified: { type: Boolean, default: false },
  videos: [{type: Schema.Types.ObjectId, ref: 'Video'}],
  liked: [{type: Schema.Types.ObjectId, ref: 'Video'}],
  disliked: [{type: Schema.Types.ObjectId, ref: 'Video'}],
  watched: [{type: Schema.Types.ObjectId, ref: 'Video'}],
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);
