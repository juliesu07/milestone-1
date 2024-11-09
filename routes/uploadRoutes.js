// server.js or relevant backend file
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Video = require('../models/Videos');
const User = require('../models/User');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');  // To generate unique filenames
const router = express.Router();

// Set up multer storage configuration for video uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '../videos');  // Folder where video files will be stored
    },
    filename: function (req, file, cb) {
        // Create a unique filename using the UUID
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

router.use(express.json());

// Route to handle video upload
router.post('/api/upload', upload.single('mp4File'), async (req, res) => {
    const { author, title } = req.body;
    if (!req.file || !author || !title) {
        return res.status(400).send('Missing required fields (author, title, mp4File)');
    }

    try {
        // Create the video document in the database
        const video = new Video({
            title: title,
            description: author,  // Assuming 'author' as description for now
            status: 'processing',     // Default status (you can change this later)
        });

        // Save video document to database
        await video.save();

        // Rename the uploaded file to the video document ID (Mongoose _id)
        const newFileName = `${video._id}${path.extname(req.file.originalname)}`;
        const oldFilePath = path.join(__dirname, '../videos', req.file.filename);
        const newFilePath = path.join(__dirname, '../videos', newFileName);

        // Rename the file to the video document's ID
        fs.renameSync(oldFilePath, newFilePath);

        // Optionally, if you want to update the user with the video ID:
        if (req.body.userId) {
            const user = await User.findById(req.body.userId);
            if (!user) {
                return res.status(404).send('User not found.');
            }

            user.videos.push(video._id);  // Add video ID to user's video list
            await user.save();
        }

        // Send a success response with video details
        res.status(200).send({ id: video._id, });

    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).send('Error uploading video');
    }
});

module.exports = router;
