const express = require('express');
const formidable = require('formidable');
const redis = require('redis');
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const User = require('../models/User');
const mongoose = require('mongoose');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

const router = express.Router();

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

// Create Redis client
const client = redis.createClient({ host: 'localhost', port: 6379 });

client.on('error', (err) => { console.error('Error connecting to Redis:', err); });

// Ensure Redis is connected
client.connect();

router.post('/upload', async (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    if (err) { return res.status(200).json({ status: 'ERROR', error: true, message: err.message }); }

    // Extract data from the request
    const author = fields.author[0];
    const title = fields.title[0];
    const description = fields.description[0];
    const mp4File = files.mp4File[0];
    const userId = req.session.userId;
    
    // Generate a unique ID for this upload
    const customId = new mongoose.Types.ObjectId();

    res.status(200).json({status: 'OK', id: customId }); // Respond with the unique upload ID immediately
    
    // Enqueue the upload task in Redis
    const uploadTask = {
      id: customId,
      userId,
      author,
      title,
      description,
      mp4FilePath: mp4File.filepath, // Temporary path before saving permanently
    };
    
    client.rPush('uploadQueue', JSON.stringify(uploadTask), (err, reply) => {
      if (err) { res.status(200).json({ status: 'ERROR', error: true, message: err.message }); }
    });
  });
});

// Process the upload queue asynchronously
async function processQueue() {
  while (true) {
    const task = await client.lPop('uploadQueue');

    if (task) {
      const uploadTask = JSON.parse(task);
      const { id, userId, author, title, description, mp4FilePath } = uploadTask;

      const video = new Video({
        _id: id,
        author,
        title,
        description,
        status: 'processing',
      });

      await video.save();
      await User.findByIdAndUpdate(userId, { $push: { videos: id } });

      // Define where to save the video file
      const destinationPath = path.join(__dirname, '..', 'videos', `${id}.mp4`);

      // Ensure the uploads directory exists by creating it if not
      if (!fs.existsSync(path.dirname(destinationPath))) { fs.mkdirSync(path.dirname(destinationPath), { recursive: true }); }

      // Simulate persisting the upload (copying file from temporary location to destination)
      fs.copyFile(mp4FilePath, destinationPath, (err) => {
        if (err) { console.error(`Error saving file for upload ID ${id}:`, err); } 
        else { console.log(`File successfully saved for upload ID ${id}`); }
      });

      backgroundProcessVideo(destinationPath, id);
    }
  }
}

// Background function to handle video processing and status update
async function backgroundProcessVideo(filePath, videoId, res) {
  try {
      // Process video and generate thumbnail in parallel
      await Promise.all([
          processVideo(filePath, videoId),
          generateThumbnail(filePath, videoId),
      ]);

      // Update video status to 'complete' after processing finishes
      await Video.findByIdAndUpdate(videoId, { status: 'complete' });
      console.log(`Video ${videoId} processed and status updated to complete`);
  } catch (error) {
      console.error(`Error processing ID ${videoId}:`, error.message);
  }
}

// Function to process video into multiple resolutions using FFmpeg
async function processVideo(inputPath, videoId) {
  return new Promise((resolve, reject) => {
      const outputDir = path.resolve(__dirname, '..', 'media');
      const outputPath = path.join(outputDir, `${videoId}.mpd`);

      // Set up the FFmpeg command to generate the DASH (adaptive bitrate) streams
      ffmpeg(inputPath).videoFilters([
          {
              filter: 'scale',
              options: {
                  w: 'if(gt(iw/ih,16/9),min(1280,iw),-2)',
                  h: 'if(gt(iw/ih,16/9),-2,min(720,ih))'
              }
          },
          {
              filter: 'pad',
              options: {
                  w: '1280',
                  h: '720',
                  x: '(1280-iw*min(1280/iw\,720/ih))/2',
                  y: '(720-ih*min(1280/iw\,720/ih))/2',
                  color: 'black'
              }
          }
      ]).outputOptions([
          '-map', '0:v', '-b:v:0', '512k', '-s:v:0', '640x360',
          '-map', '0:v', '-b:v:1', '768k', '-s:v:1', '960x540',
          '-map', '0:v', '-b:v:2', '1024k', '-s:v:2', '1280x720',
          '-f', 'dash',
          '-seg_duration', '10',
          '-use_template', '1',
          '-use_timeline', '1',
          '-adaptation_sets', 'id=0,streams=v',
          '-init_seg_name', `${videoId}_init_$RepresentationID$.m4s`,
          '-media_seg_name', `${videoId}_chunk_$Bandwidth$_$Number$.m4s`
      ]).on('end', () => {
          console.log('Video processing complete');
          resolve();
      }).on('error', (err) => {
          console.error('Error processing video:', err);
          reject(err);
      })
      .save(outputPath);
  });
}

async function generateThumbnail(inputPath, videoId) {
    return new Promise((resolve, reject) => {
        const thumbnailDir = path.resolve(__dirname, '..', 'thumbnails');
        const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

        const THUMBNAIL_WIDTH = 320;
        const THUMBNAIL_HEIGHT = 180;

        ffmpeg(inputPath)
            .on('end', () => {
                console.log(`Thumbnail generated at ${thumbnailPath}`);
                resolve(thumbnailPath);
            })
            .on('error', (err) => {
                console.error('Error generating thumbnail:', err);
                reject(err);
            })
            .output(thumbnailPath)
            .outputOptions([
                `-vf`,
                `scale='if(gt(iw/ih,${THUMBNAIL_WIDTH}/${THUMBNAIL_HEIGHT}),${THUMBNAIL_WIDTH},-1)':'if(gt(iw/ih,${THUMBNAIL_WIDTH}/${THUMBNAIL_HEIGHT}),-1,${THUMBNAIL_HEIGHT})',` +
                `pad=${THUMBNAIL_WIDTH}:${THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2`
            ])
            .frames(1)
            .run();
    });
}

// Start processing the queue in the background
processQueue();

module.exports = router;