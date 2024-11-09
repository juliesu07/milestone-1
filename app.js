const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo'); 
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path'); // Import the path module
const User = require('./models/User');
const Video = require('./models/Video');
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');

// MongoDB connection
mongoose.connect('mongodb://130.245.136.220:27017/milestone-1')
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(express.static('public')); // Serve static files

// Session setup
app.use(session({
    secret: 'jaws', // Change this to a random secret
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/milestone-1', // Your MongoDB connection string
        ttl: 14 * 24 * 60 * 60 // = 14 days. Default
    }),
    cookie: {
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    }
}));

const checkSession = async (req, res, next) => {
    if (req.session && req.session.userId) {
    	const user = await User.findById(req.session.userId);
    	if (!user) { return res.status(200).json({ status: 'ERROR', error:true, message: "Not valid user" }); }        
	    next();
    } else {
	    res.redirect('/login');
    }
};

const checkSessionVideos = async (req, res, next) => {
    if (req.session && req.session.userId) {
        const user = await User.findById(req.session.userId);
        if (!user) { return res.status(200).json({ status: 'ERROR', error:true, message: "Not valid user" }); }
        next();
    } else {
        res.status(200).json({ status: 'ERROR', error: true, message: 'Not logged in' });
    }
};


app.get('/', checkSession, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html')); // Serve the dashboard-homepage
});

app.use('/media/:id', checkSession, async (req, res) => {
    console.log("Requested parameters:", req.params.id);
    
    let videoId = req.params.id;
    let filePath;
  
    try {
      if (videoId.endsWith('.m4s')) {
        // Handling .m4s segment files
        filePath = path.join(__dirname, 'media', videoId);
        console.log("Serving .m4s file:", filePath);
  
        // Set Content-Type for .m4s files
        res.setHeader('Content-Type', 'video/mp4');
      } else {
        // Handling .mpd manifest files
        const trimmedVideoId = videoId.slice(0, -4); // Remove .mpd extension
        console.log("Processed video ID:", trimmedVideoId);
  
        // Fetch video details from the database
        const video = await Video.findById(trimmedVideoId);
        if (!video) {
          return res.status(404).json({
            status: 'ERROR',
            error: true,
            message: 'Video not found'
          });
        }
  
        // Construct the path for the .mpd file based on the video title
        const title = video.title.endsWith('.mp4') ? video.title.slice(0, -4) : video.title;
        filePath = path.join(__dirname, 'media', `${title}.mpd`);
        console.log("Serving .mpd file:", filePath);
  
        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({
            status: 'ERROR',
            error: true,
            message: 'File not found on server'
          });
        }
  
        // Set Content-Type for .mpd files
        res.setHeader('Content-Type', 'application/dash+xml');
      }
  
      // Send the file to the client
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          res.status(500).end();
        } else {
          console.log("File sent successfully.");
        }
      });
      
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({
        status: 'ERROR',
        error: true,
        message: 'An error occurred while retrieving the video file'
      });
    }
  });

// app.use('/media', checkSession, express.static(path.join(__dirname, 'media')));

// Route to serve the MPEG-DASH manifest
app.get('/media/output.mpd', checkSession, (req, res) => {
    res.sendFile(path.join(__dirname, 'media', 'output.mpd'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/play/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// Routes
app.use('/api', userRoutes);
app.use('/api', authRoutes);
app.use('/api', checkSessionVideos, videoRoutes);
app.use('/api', checkSessionVideos, uploadRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
