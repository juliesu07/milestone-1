const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    _id: {type: Number},
    description: String,
    title: String,
    status: String,
    like: {type: Number, default: 0},
    dislike: {type: Number, default: 0},
});

module.exports = mongoose.model('Video', videoSchema);
