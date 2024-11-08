const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo'); 
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const path = require('path'); // Import the path module
const User = require('./models/User');
const app = express();
const PORT = process.env.PORT || 3000;

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
	/*
        const isAjaxRequest = req.xhr || req.headers.accept.includes('json');

        if (isAjaxRequest) {
            // Respond with JSON if it's an AJAX request
            res.status(200).json({ status: 'ERROR', error: true, message: 'Not logged in' });
        } else {
            // Redirect to login page if it's a standard request
            res.redirect('/login');
        }*/
	res.redirect('/login');
    }
};

const checkSessionVideos = async (req, res, next) => {
    if (req.session && req.session.userId) {
        const user = await User.findById(req.session.userId);
        if (!user) { return res.status(200).json({ status: 'ERROR', error:true, message: "Not valid user" }); }
        next();
    } else {
        /*
        const isAjaxRequest = req.xhr || req.headers.accept.includes('json');

        if (isAjaxRequest) {
            // Respond with JSON if it's an AJAX request
            res.status(200).json({ status: 'ERROR', error: true, message: 'Not logged in' });
        } else {
            // Redirect to login page if it's a standard request
            res.redirect('/login');
        }*/
        res.status(200).json({ status: 'ERROR', error: true, message: 'Not logged in' });
    }
};


app.get('/', checkSession, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html')); // Serve the dashboard-homepage
});

app.use('/media', checkSession, express.static(path.join(__dirname, 'media')));

// Route to serve the MPEG-DASH manifest
app.get('/media/output.mpd', checkSession, (req, res) => {
    res.sendFile(path.join(__dirname, 'media', 'output.mpd'));
});
/*
app.get('/media/chunk_:bandwidth_:segmentNumber.m4s', checkSession, (req, res) => {
    const { bandwidth, segmentNumber } = req.params;

    // Construct the chunk filename based on the bandwidth and segment number
    const chunkFile = `chunk_${bandwidth}_${segmentNumber}.m4s`; // Use backticks here

    // Send the chunk file
    res.sendFile(path.join(__dirname, 'media', chunkFile), (err) => {
        if (err) {
            res.status(err.status).end(); // Handle errors
        }
    });
});
*/
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/play/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'play.html'));
});


// Routes
app.use('/api', userRoutes);
app.use('/api', authRoutes);
app.use('/api', checkSessionVideos, videoRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
