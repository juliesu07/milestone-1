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
    // console.log(err);
    res.status(500).json({ status: 'Error', message: "Blame Anna for not being able to retrieve videos" });
  }
});

// Send Random Video that does not match eid
router.get('/randvideo/:eid', async (req, res) => {
  const { eid } = req.params;
  try {
    // Use aggregate with $match, $sample, and $project to get 10 random video IDs excluding the one with eid
    const videos = await Video.aggregate([
      { $match: { _id: { $ne: eid } } },
      { $sample: { size: 10 } },
      { $project: { _id: 1 } } // Only include the _id field
    ]);

    if (videos.length === 0) {
      return res.status(404).json({ status: 'Error', message: 'No other videos found.' });
    }

    // Extract the IDs into an array
    const videoIds = videos.map(video => video._id);
    return res.json({ status: 'OK', videoIds });
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
  // console.log(videoId);
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const viewed = user.watched.includes(videoId);
  

  if (!viewed) {
    user.watched.push(videoId);
    // console.log(user.watched);
    await user.save();
  }

  return res.json({ status: 'OK', viewed: viewed, });
});

router.post('/like', async (req, res) => {
  const { id: videoId, value } = req.body;
  const userId = req.session.userId;

  try {
    const user = await User.findById(userId);
    const video = await Video.findById(videoId);

    const liked = user.liked.includes(videoId);
    const disliked = user.disliked.includes(videoId);

    // Prevent duplicate actions
    if ((value && liked) || (!value && disliked)) {
      return res.status(200).json({
        status: 'ERROR',
        error: true,
        message: "The value that you want to set is the same"
      });
    }

    if (value) {
      if (disliked) {
        user.disliked.pull(videoId);
        video.dislike -= 1; // Ensure field names match schema
      }
      user.liked.push(videoId);
      video.like += 1; // Ensure field names match schema
    } else {
      if (liked) {
        user.liked.pull(videoId);
        video.like -= 1;
      }
      user.disliked.push(videoId);
      video.dislike += 1;
    }

    await user.save();
    await video.save();

    res.status(200).json({
      status: 'OK',
      likes: video.like, // Ensure field names match schema
      dislikes: video.dislike // Optional, if you want to return the dislike count
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'ERROR',
      error: true,
      message: 'An error occurred while updating like status'
    });
  }
});


module.exports = router;
