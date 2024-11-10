const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Video = require('../models/Video');
const User = require('../models/User');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process'); // For running shell commands
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

            // Define output paths for video and thumbnails
            const videoOutputDir = path.resolve(__dirname, '..', 'media');
            const thumbnailOutputDir = path.resolve(__dirname, '..', 'thumbnails');
            
            const videoPath = newFilePath; // Full input path for ffmpeg
            const thumbnailPath = path.join(thumbnailOutputDir, `${video._id}.jpg`);

            const videoBaseName = path.basename(videoPath, path.extname(videoPath));  // Get the file name without the extension

            const ffmpegCmd = `
                ffmpeg -i "${videoPath}" -vf "scale='if(gt(iw/ih,16/9),min(1280\,iw),-2)':'if(gt(iw/ih,16/9),-2,min(720\,ih))',pad=1280:720:(1280-iw*min(1280/iw\,720/ih))/2:(720-ih*min(1280/iw\,720/ih))/2:black" \
                -map 0:v -b:v:0 254k -s:v:0 320x180 \
                -map 0:v -b:v:1 507k -s:v:1 320x180 \
                -map 0:v -b:v:2 759k -s:v:2 480x270 \
                -map 0:v -b:v:3 1013k -s:v:3 640x360 \
                -map 0:v -b:v:4 1254k -s:v:4 640x360 \
                -map 0:v -b:v:5 1883k -s:v:5 768x432 \
                -map 0:v -b:v:6 3134k -s:v:6 1024x576 \
                -map 0:v -b:v:7 4952k -s:v:7 1280x720 \
                -f dash -seg_duration 10 -use_template 1 -use_timeline 1 -adaptation_sets "id=0,streams=v" \
                -init_seg_name "${videoBaseName}_init_\$RepresentationID\$.m4s" \
                -media_seg_name "${videoBaseName}_chunk_\$Bandwidth\$_\$Number\$.m4s" \
                "${videoOutputDir}/${video._id}.mpd"
            `;

            // Execute ffmpeg command to process the video
            exec(ffmpegCmd, (err, stdout, stderr) => {
                if (err) {
                    console.error('Error processing video:', stderr);  // Capturing stderr output for detailed error
                    return res.status(500).send('Error processing video');
                }

                console.log('Video processing complete:', stdout);

                // Now generate a thumbnail
                const thumbnailCmd = `
                    ffmpeg -i "${videoPath}" -ss 00:00:00.000 -vframes 1 -vf "scale='if(gt(iw/ih,${320}/180),${320},-1)':'if(gt(iw/ih,${320}/180),-1,${180})',pad=${320}:${180}:(ow-iw)/2:(oh-ih)/2" "${thumbnailPath}" -y
                `;

                // Execute thumbnail creation command
                exec(thumbnailCmd, (err, stdout, stderr) => {
                    if (err) {
                        console.error('Error creating thumbnail:', stderr);
                        return res.status(500).send('Error creating thumbnail');
                    }

                    console.log('Thumbnail creation complete:', stdout);

                    // Update the video status to "complete" after processing and thumbnail creation
                    Video.findByIdAndUpdate(video._id, { status: 'complete' }, { new: true }, (err, updatedVideo) => {
                        if (err || !updatedVideo) {
                            console.error('Error updating video status:', err);
                            return res.status(500).send('Error updating video status');
                        }

                        console.log('Video status updated to complete');
                        
                        // Optionally, if you want to update the user with the video ID:
                        if (req.body.userId) {
                            User.findById(req.body.userId, (err, user) => {
                                if (err || !user) {
                                    return res.status(404).send('User not found');
                                }
                                user.videos.push(updatedVideo._id);
                                user.save()
                                    .then(() => res.status(200).send({ id: updatedVideo._id }))
                                    .catch((error) => res.status(500).send('Error updating user video list'));
                            });
                        } else {
                            res.status(200).send({ id: updatedVideo._id });
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).send('Error uploading video');
    }
});

module.exports = router;
