// server.js or relevant backend file
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');  // To generate unique filenames

const router = express.Router();

// Set up multer storage configuration for video uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Folder where video files will be stored
        cb(null, path.join(__dirname, '../videos'));  // Ensure 'videos' folder is in the correct location
    },
    filename: function (req, file, cb) {
        // Create a unique filename using the UUID
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 100 * 1024 * 1024 }  // 100 MB file size limit
}).single('video');  // Field name 'video' must match the form input field

router.use(express.json());

// Route to handle video upload
router.post('/upload', upload, async (req, res) => {
    const { author, title } = req.body;

    // Check if Multer did anything and whether the required fields are present
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    if (!author || !title) {
        return res.status(400).send('Missing required fields (author, title)');
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

        // Wait until multer has finished handling the file before renaming
        const newFileName = `${video._id}${path.extname(req.file.originalname)}`;
        const oldFilePath = path.join(__dirname, '../videos', req.file.filename);
        const newFilePath = path.join(__dirname, '../videos', newFileName);

        // Rename the file to the video document's ID (after multer has uploaded it)
        fs.rename(oldFilePath, newFilePath, (err) => {
            if (err) {
                console.error('Error renaming file:', err);
                return res.status(500).send('Error renaming video file');
            }

            // Update the video document with the new filename
            video.filename = newFileName;  // Add filename to the video document

            // Optionally, update the user with the video ID:
            if (req.body.userId) {
                const user = await User.findById(req.body.userId);
                if (!user) {
                    return res.status(404).send('User not found.');
                }

                user.videos.push(video._id);  // Add video ID to user's video list
                await user.save();
            }

            // Send a success response with video details
            res.status(200).send({
                message: 'Video uploaded successfully',
                videoId: video._id,
                filename: newFileName, // Send back the new file name
            });
        });

    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).send('Error uploading video');
    }
});

module.exports = router;
