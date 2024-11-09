// routes/videoRoutes.js
const express = require('express');
const router = express.Router();
const videoData = require('../videos/m1.json');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const Video = require('../models/Video');
const User = require('../models/User');
const { ObjectId } = require('mongoose').Types;

router.post('/like', async (req, res) => {
  const { id: videoId, value } = req.body;
  console.log(videoId + " | " + value);
  const userId = req.session.userId;
  console.log(userId);

  try {
    const user = await User.findById(userId);
    const video = await Video.findById(videoId);
    const objectIdVideoId = new ObjectId(videoId);  // Cast videoId to ObjectId
    const liked = user.liked.includes(objectIdVideoId);
    const disliked = user.disliked.includes(objectIdVideoId);

    console.log('called');

    if ((value && liked) || (!value && disliked)) {
      return res.status(200).json({
        status: 'ERROR', error: true, message: "The value that you want to set is the same"
      });
    }

    if (value) {
      if (disliked) {
        user.disliked.pull(objectIdVideoId);
        video.dislike -= 1;
      }
      user.liked.push(objectIdVideoId);
      video.like += 1;
    } else {
      if (liked) {
        user.liked.pull(objectIdVideoId);
        video.like -= 1;
      }
      user.disliked.push(objectIdVideoId);
      video.dislike += 1;
    }

    console.log(video.like);
    console.log(user.liked);

    await user.save();
    await video.save();

    res.status(200).json({ status: 'OK', likes: video.like });
  } catch (err) {
    res.status(200).json({
      status: 'ERROR',
      error: true,
      message: 'An error occurred when updating likes'
    });
  }
});


// Get count number of video entires
router.post('/videos', async (req, res) => {
  const { count} = req.body;
  const userId = req.session.userId;
  // PLEASE READ add ml library, im just editing the format of the json 

  try {
    const videoEntries = await Video.find({}).limit(count);
    const user = await User.findById(userId);
    const videos = videoEntries.map(({_id, description, title, like}) => ({
      id: String(_id),
      description: description,
      title: title,
      watched: user.watched.includes(_id),
      liked: user.liked.includes(_id),
      likevalues: like,
    }));

    return res.json({
      status: 'OK',
      videos,
    });
  }
  catch (err) {
    console.log(err);
    res.status(500).json({
      status: 'Error',
      message: "Blame Anna for not being able to retrieve videos",
    });
  }
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
router.get('/manifest/:id', async (req, res) => {
    const videoId = req.params.id;
    try
    {
      const video = await Video.findById(videoId);
      const title = video.title.endsWith('.mp4') ? video.title.slice(0, -4) : video.title;
      // console.log(title);
      const manifestPath = path.join(__dirname, '../media', `${title}.mpd`);
  
      res.sendFile(manifestPath, err => {
          if (err) {
              res.status(err.status).end();
          }
      });

    }
    catch (err)
    {
      res.status(200).json({
        status: 'ERROR',
        error: true,
        message: 'An error occurred when updatin likes'
      })
    }
    // Construct the manifest path based on the presence of a file type
});


// GET /thumbnail/:id - Send thumbnail for video with id :id
router.get('/thumbnail/:id', async (req, res) => {
    // console.log(req.body);
    const videoId = req.params.id;
    try
    {
      const video = await Video.findById(videoId)
      const title = video.title.endsWith('.mp4') ? video.title.slice(0, -4) : video.title;
      const thumbnailPath = path.join(__dirname, '../thumbnails', `${title}.jpg`); // Adjust based on your video naming convention
      
      res.sendFile(thumbnailPath, err => {
          if (err) {
              res.status(err.status).end();
          }
      });
    }
    catch (err)
    {
      res.status(200).json({
        status: 'ERROR',
        error: true,
        message: 'An error occurred when updatin likes'
      })
    }

});

router.post('/view', async (req, res) => {
  const { id:videoId } = req.body;
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const viewed = user.watched.includes(videoId);

  if (!viewed)
  {
    user.watched.push(videoId);
    await user.save();
  }

  return res.json({
    status: 'OK',
    viewed: viewed,
  });
});

router.post('/like', async (req, res) => {
  const { id, value } = req.body;
  const videoId = new ObjectId(id);
  const userId = req.session.userId;

  try {
    const user = await User.findById(userId);
    const video = await Video.findById(videoId);

    // Initialize if undefined
    if (!user.liked) user.liked = [];
    if (!user.disliked) user.disliked = [];
    if (video.like === undefined) video.like = 0;
    if (video.dislike === undefined) video.dislike = 0;

    const liked = user.liked.includes(videoId);
    const disliked = user.disliked.includes(videoId);

    console.log('called')

    if ((value && liked) || (!value && disliked)) {
      return res.status(200).json({
        status: 'ERROR', error: true, message: "The value that you want to set is the same"
      });
    }

    if (value) {
      if (disliked) {
        user.disliked.pull(videoId);
        video.dislike -= 1;
      }
      user.liked.push(videoId);
      video.like += 1;
    } else {
      if (liked) {
        user.liked.pull(videoId);
        video.like -= 1;
      }
      user.disliked.push(videoId);
      video.dislike += 1;
    }

    console.log(video.like);
    console.log(user.liked);

    await user.save();
    await video.save();

    res.status(200).json({ status: 'OK', likes: video.like });
  } catch (err) {
    res.status(200).json({
      status: 'ERROR',
      error: true,
      message: err.message
    });
  }
});


module.exports = router;
