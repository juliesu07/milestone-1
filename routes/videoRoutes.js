// routes/videoRoutes.js
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const router = express.Router();
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const Video = require('../models/Video');
const User = require('../models/User');

const client = createClient();
client.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis
(async () => {
  await client.connect();
})();

router.post('/videos1', async (req, res) => {
  const { count} = req.body;
  const userId = req.session.userId;
  // PLEASE READ add ml library, im just editing the format of the json 

  // Unique request ID to track this specific recommendation request
  const requestId = uuidv4();

  // Enqueue the request with user ID and count in Redis
  const requestPayload = JSON.stringify({ requestId, userId, count });
  await client.lPush('recommendation_queue', requestPayload);  // Using lPush in Redis v4.x

  // Listen for the response on Redis
  const responseKey = `recommendation_response_${requestId}`;
  try {
    // Block until the response arrives or a timeout occurs (30 seconds)
    const response = await client.blPop(responseKey, 30);  // Using blPop in Redis v4.x
    
    if (response) {
      // Parse the response and send it back to the client
      const recommendedVideos = JSON.parse(response.element).videos;
      return res.json({ videos: recommendedVideos });
    } else {
      // If no response is received within the timeout, send an error
      return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
    }
  } catch (err) {
    // Handle any unexpected errors
    console.error('Error processing recommendations:', err);
    return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
  }
});








// Get count number of video entires
router.post('/videos', async (req, res) => {
  const { count} = req.body;
  const userId = req.session.userId;

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
    // Use aggregate with $match, $sample, and $project to get 10 random video IDs excluding the one with eid
    const videos = await Video.aggregate([
      { $match: { _id: { $ne: eid } } },
      { $sample: { size: 10 } },
      { $project: { _id: 1 } } // Only include the _id field
    ]);

    if (videos.length === 0) {
      return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
    }

    // Extract the IDs into an array
    const videoIds = videos.map(video => video._id);
    return res.json({ status: 'OK', videoIds });
  } catch (error) {
    return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
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
