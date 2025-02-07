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
const { makeUserRecommendations, makeVideoRecommendations } = require('../workers/recremmended');
const mongoose = require('mongoose');

// const client = createClient();
// client.on('error', (err) => console.error('Redis Client Error', err));

// // Connect to Redis
// (async () => {
//   await client.connect();
// })();

mongoose.connect('mongodb://localhost:27017/milestone-1', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

router.post('/videos', async (req, res) => {
  const { count, videoId} = req.body;
  const userId = req.session.userId;

  // // Unique request ID to track this specific recommendation request
  // const requestId = uuidv4();

  // // Enqueue the request with user ID and count in Redis
  // const requestPayload = JSON.stringify({ requestId, userId, count });
  // await client.lPush('recommendation_queue', requestPayload);  // Using lPush in Redis v4.x

  // // Listen for the response on Redis
  // const responseKey = `recommendation_response_${requestId}`;
  // try {
  //   // Block until the response arrives or a timeout occurs (30 seconds)
  //   const response = await client.blPop(responseKey, 30);  // Using blPop in Redis v4.x

  //   if (response) {
  //     // Parse the response and send it back to the client
  //     const recommendedVideos = JSON.parse(response.element).videos;
  //     // console.log(recommendedVideos)
  //     return res.json({ status: 'OK', videos: recommendedVideos });
  //   } else {
  //     // If no response is received within the timeout, send an error
  //     return res.status(200).json({ status: 'ERROR', error: true, message:"no response from timeout" });
  //   }
  // } catch (err) {
  //   // Handle any unexpected errors
  //   // console.error('Error processing recommendations:', err);
  //   return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
  // }
  
  // video_details = [
  //   {
  //       "id": str(video["_id"]),
  //       "description": video["description"],
  //       "title": video["title"],
  //       "watched": video["_id"] in watched_videos,
  //       "liked": video["_id"] in liked_videos,
  //       "likevalues": video["like"]
  //   }

// CAN DELETE:
try
{
    let videos = await Video.findOne({});
    console.log(videos);
    if (videos == null)
    {
        return res.json({status: 'OK', videos: {}});
    }
  }
  catch (err)
  {
    return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
  }
// CAN DELETE ^


  if (videoId != null)
  {
    const recommendedVideoIds = await makeVideoRecommendations(videoId, userId, count);
    try
    {
      let user = await User.findById(userId);
      const videos = [];
      for (let i = 0; i < recommendedVideoIds.length; i++)
      {
        let video = await Video.findById(recommendedVideoIds[i].itemId);
        let videoData = {
          id: video._id,
          description: video.description,
          title: video.title,
          watched: user.watched.includes(video._id),
          liked: user.liked.includes(video._id),
          likevalues: video.like
        }
        videos.push(videoData);
      }
      return res.json({ status: 'OK', videos: videos });
    }
    catch (err)
    {
      return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
    }
  }

  const recommendedVideos = await makeUserRecommendations(userId, count);
  try
  {
    let user = await User.findById(userId);
    const videos = [];
    for (let i = 0; i < recommendedVideos.length; i++)
    {
      let video = await Video.findById(recommendedVideos[i].itemId);
      let videoData = {
        id: video._id,
        description: video.description,
        title: video.title,
        watched: user.watched.includes(video._id),
        liked: user.liked.includes(video._id),
        likevalues: video.like
      }
      videos.push(videoData);
    }
    return res.json({ status: 'OK', videos: videos });
  }
  catch (err)
  {
    return res.status(200).json({ status: 'ERROR', error: true, message: err.message });
  }

});

// GET /manifest/:id - Send DASH manifest for video with id :id
router.get('/manifest/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
      const manifestPath = path.join(__dirname, '../media', `${videoId}.mpd`);
      res.sendFile(manifestPath, err => {
        if (err) { res.status(200).json({ status: 'ERROR', error: true, message: err.message });}
      });
    } catch (err) {
      res.status(200).json({ status: 'ERROR', error: true, message: err.message });
    }
});

router.get('/getVideo/:id', async (req, res) => {
    console.log("hello");
    const videoId = req.params.id;
    const userId = req.session.userId;
    try {
      const video = await Video.findById(videoId);
      const user = await User.findById(userId);
      return res.status(200).json({
        id: video.id,
        description: video.description,
        title: video.title,
        watched: user.watched.includes(video.id),
        liked: user.liked.includes(video.id),
        likevalues: video.like,
      });
    }
    catch (err)
    {
      res.status(200).json({status: 'ERROR', error: true, message: err.message});
    }
});

// GET /thumbnail/:id - Send thumbnail for video with id :id
router.get('/thumbnail/:id', async (req, res) => {
    const videoId = req.params.id;
    // console.log(videoId);
    try {
      const thumbnailPath = path.join(__dirname, '../thumbnails', `${videoId}.jpg`); // Adjust based on your video naming convention
      res.sendFile(thumbnailPath, err => {
        if (err) { res.status(200).json({ status: 'ERROR', error: true, message: err.message }); }
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
      return res.status(200).json({ status: 'ERROR', error: true, message: "The value that you want to set is the same" });
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

    res.status(200).json({ status: 'OK', likes: video.like });
  } catch (error) {
    console.error(error);
    res.status(200).json({ status: 'ERROR', error: true, message: 'An error occurred while updating like status' });
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
