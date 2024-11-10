const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Video = require('../models/Video');
const User = require('../models/User');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Set up multer storage configuration for video uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.resolve(__dirname, '..', 'videos'));  // Ensure path resolves correctly
    },
    filename: function (req, file, cb) {
        // Create a unique filename using the UUID
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});

// Define file size and type limits for safety
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/mkv', 'video/webm'];  // Add any other types you want to support
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type, only MP4, MKV, or WEBM allowed'));
        }
        cb(null, true);
    }
}).single('video');

router.use(express.json());

// Route to handle video upload
router.post('/upload', upload, async (req, res) => {
    const { author, title } = req.body;
    if (!req.file || !author || !title) {
        return res.status(400).send('Missing required fields (author, title, or video file)');
    }

    try {
        // Create the video document in the database
        const video = new Video({
            title: title,
            description: author,  // Assuming 'author' as description for now
            status: 'processing',  // Default status
        });

        // Save video document to database
        await video.save();

        // Rename the uploaded file to the video document ID (Mongoose _id)
        const newFileName = `${video._id}${path.extname(req.file.originalname)}`;
        const oldFilePath = path.join(__dirname, '..', 'videos', req.file.filename);
        const newFilePath = path.join(__dirname, '..', 'videos', newFileName);

        // Rename the file to the video document's ID (asynchronously)
        fs.rename(oldFilePath, newFilePath, (err) => {
            if (err) {
                console.error('Error renaming file:', err);
                return res.status(500).send('Error renaming file');
            }

            // Optionally, if you want to update the user with the video ID:
            if (req.body.userId) {
                User.findById(req.body.userId, (err, user) => {
                    if (err || !user) {
                        return res.status(404).send('User not found');
                    }
                    user.videos.push(video._id);
                    user.save()
                        .then(() => res.status(200).send({ id: video._id }))
                        .catch((error) => res.status(500).send('Error updating user video list'));
                });
            } else {
                res.status(200).send({ id: video._id });
            }
        });

    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).send('Error uploading video');
    }
});

module.exports = router;
