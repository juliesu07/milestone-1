// routes/videoRoutes.js
const express = require('express');
const router = express.Router();
const videoData = require('../videos/m1.json');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// Get count number of video entires
router.post('/videos', (req, res) => {
  const { count } = req.body;
  const videoEntries = Object.entries(videoData);
  const videos = videoEntries.slice(0, count).map(([title, description]) => ({
    id: title.endsWith('.mp4') ? title.slice(0, -4) : title,
    metadata: {
      title,
      description,
    },
  }));

  return res.json({
    status: 'OK',
    videos,
  });
});

// Send Random Video that does not match eid
router.get('/randvideo/:eid', (req, res) => {
  const { eid } = req.params;
  const videoEntries = Object.entries(videoData).filter(([id]) => id !== eid); // Exclude entry with the same title as eid

  if (videoEntries.length === 0) {
    return res.status(404).json({ status: 'Error', message: 'No other videos found.' });
  }

  // Get a random entry from the filtered list
  const randomEntry = videoEntries[Math.floor(Math.random() * videoEntries.length)];
  const [id, description] = randomEntry;

  // Format the response to remove .mp4 from the title if present
  const video = {
    title: id.endsWith('.mp4') ? id.slice(0, -4) : id,
    description,
  };

  return res.json({
    status: 'OK',
    video,
  });
});

// GET /manifest/:id - Send DASH manifest for video with id :id
router.get('/manifest/:id', (req, res) => {
    const videoId = req.params.id;

    // Construct the manifest path based on the presence of a file type
    const manifestPath = path.join(__dirname, '../media', `${videoId}.mpd`);

    res.sendFile(manifestPath, err => {
        if (err) {
            res.status(err.status).end();
        }
    });
});


// GET /thumbnail/:id - Send thumbnail for video with id :id
router.get('/thumbnail/:id', (req, res) => {
    const videoId = req.params.id;
    const thumbnailPath = path.join(__dirname, '../thumbnails', `${videoId}.jpg`); // Adjust based on your video naming convention
    
    res.sendFile(thumbnailPath, err => {
        if (err) {
            res.status(err.status).end();
        }
    });

});

module.exports = router;
