// routes/videoRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const Video = require('../models/Video');
const User = require('../models/User');

// Get count number of video entires
router.post('/videos', async (req, res) => {
  const { count} = req.body;
  const userId = req.session.userId;
  // PLEASE READ add ml library, im just editing the format of the json 

  try {
    const videoEntries = await Video.find({}).limit(count);
    const user = await User.findById(userId);
    const videos = videoEntries.map(({_id, description, title, like}) => ({
      id: _id,
      description: description,
      title: title,
      watched: user.watched.includes(_id),
      liked: user.liked.includes(_id),
      likevalues: like,
    }));

    return res.json({ status: 'OK', videos, });
  }
  catch (err) {
    console.log(err);
    res.status(500).json({ status: 'Error', message: "Blame Anna for not being able to retrieve videos" });
  }
});

// Send Random Video that does not match eid
router.get('/randvideo/:eid', async (req, res) => {
  const { eid } = req.params;
  try {
    // Query to get only the IDs of videos except the one with the specified eid
    const videos = await Video.find({ _id: { $ne: eid } }).select('_id');
    
    if (videos.length === 0) { return res.status(404).json({ status: 'Error', message: 'No other videos found.' }); }

    // Extract only the IDs into an array
    const videoIds = videos.map(video => video._id);

    // Get a random ID from the list of video IDs
    const randomVideoId = videoIds[Math.floor(Math.random() * videoIds.length)];
    return res.json({ status: 'OK', videoId: randomVideoId });
  } catch (error) {
    return res.status(500).json({ status: 'Error', message: 'Internal server error.' });
  }
});

// GET /manifest/:id - Send DASH manifest for video with id :id
router.get('/manifest/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
      const manifestPath = path.join(__dirname, '../media', `${videoId}.mpd`);
      res.sendFile(manifestPath, err => {
        if (err) { res.status(err.status).end(); }
      });
    } catch (err) {
      res.status(200).json({ status: 'ERROR', error: true, message: err.message });
    }
});


// GET /thumbnail/:id - Send thumbnail for video with id :id
router.get('/thumbnail/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
      const thumbnailPath = path.join(__dirname, '../thumbnails', `${videoId}.jpg`); // Adjust based on your video naming convention
      res.sendFile(thumbnailPath, err => {
        if (err) { res.status(err.status).end(); }
      });
    } catch (err) {
      res.status(200).json({ status: 'ERROR', error: true, message: 'An error occurred' })
    }
});

router.post('/view', async (req, res) => {
  const { id: videoId } = req.body;
  console.log(videoId);
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const viewed = user.watched.includes(videoId);
  

  if (!viewed) {
    user.watched.push(videoId);
    console.log(user.watched);
    await user.save();
  }

  return res.json({ status: 'OK', viewed: viewed, });
});

router.post('/like', async (req, res) => {
  const { id: videoId, value } = req.body;
  const userId = req.session.userId;

  try {
    // Fetch the user and video
    const user = await User.findById(userId);
    const video = await Video.findById(videoId);
    const liked = user.liked.includes(videoId);
    const disliked = user.disliked.includes(videoId);

    const updateUser = {};
    const updateVideo = {};

    // Handle like action
    if (value) {
      if (liked) { // Remove from likes if already liked
        updateUser.$pull = { liked: videoId };
        updateVideo.$inc = { like: -1 };
      } else { // Else Add to liked
        if (disliked) { // Remove from dislikes if already disliked
          updateUser.$pull = { disliked: videoId };
          updateVideo.$inc = { dislike: -1 };
        }
        updateUser.$addToSet = { liked: videoId };
        updateVideo.$inc = { like: 1 };
      }
    } else {
      if (disliked) { // Remove from dislikes if already disliked
        updateUser.$pull = { disliked: videoId };
        updateVideo.$inc = { dislike: -1 };
      } else { // Else Add to disliked
        if (liked) { // Remove from likes if already liked
          updateUser.$pull = { liked: videoId };
          updateVideo.$inc = { like: -1 };
        }
        updateUser.$addToSet = { disliked: videoId };
        updateVideo.$inc = { dislike: 1 };
      }
    }

    // Update user and video with atomic operations
    await User.findByIdAndUpdate(userId, updateUser);
    await Video.findByIdAndUpdate(videoId, updateVideo);

    res.status(200).json({ status: 'OK', likes: video.like });
  } catch (err) {
    res.status(200).json({ status: 'ERROR', error: true, message: err.message });
  }
});

router.get('/processing-status', async (req, res) => {
    const userId = req.session.userId;
    try {
      const user = await User.findById(userId);
      const videoIds = user.videos;
      const videos = [];
      for (let i = 0; i < videoIds.length; i++) {
        const videoStats = await Video.findById(videoIds[i]);
        let video = {
          id: videoStats.id,
          title: videoStats.title,
          status: videoStats.status
        }
        videos.push(video);
      }
      return res.status(200).json({ status: 'OK', videos: videos })
    } catch (err) {
      res.status(200).json({ status: 'ERROR', error: true, message: err.message });
    }
});

module.exports = router;
