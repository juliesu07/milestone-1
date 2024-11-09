const mongoose = require('mongoose');
const path = require('path'); // Import path if needed for directories
const Video = require('../models/Video'); // Import your Video model
const videoData = require('../videos/m1.json');
const Counter = require('../models/Counter');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/milestone-1', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch(error => {
    console.error("Error connecting to MongoDB:", error);
});

async function initializeCounter() {
    const counterExists = await Counter.exists({ _id: 'video_id' });
    if (!counterExists) {
        await Counter.create({ _id: 'video_id', sequence_value: 0 });
    }
}

initializeCounter();

async function getNextVideoId() {
    const counter = await Counter.findByIdAndUpdate(
        'video_id',
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true } // Return updated counter and create if it doesn't exist
    );
    return counter.sequence_value;
}

// Function to scan directory and add videos to the database
async function addVideosToDatabase() {
    try {
        const videoEntries = Object.entries(videoData);
        for (let [title, description] of videoEntries) {
            const videoId = await getNextVideoId(); // Await here to get the ID

            const video = {
                _id: videoId,
                title: title,
                description: description,
                status: "complete",
                like: 0,
                dislike: 0
            };

            const newVideo = new Video(video);
            await newVideo.save();
            console.log(`Added video: ${video.title} with ID: ${videoId}`);
        }
    } catch (error) {
        console.error("Error adding videos:", error);
    } finally {
        mongoose.connection.close(); // Close connection after adding videos
    }
}

addVideosToDatabase();