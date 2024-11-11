// models/Video.js
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    description: String,
    title: String,
    status: String,
    like: {type: Number, default: 0},
    dislike: {type: Number, default: 0},
    index: {type: Number},
});

module.exports = mongoose.model('Video', videoSchema);