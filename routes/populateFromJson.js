const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video'); // Adjust the path to your Video model

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/milestone-1', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log("Connected to MongoDB");
    importVideosFromJSON();
})
.catch(error => {
    console.error("Error connecting to MongoDB:", error);
});

// Function to import videos from JSON file to MongoDB
async function importVideosFromJSON() {
    try {
        // Path to the JSON file
        const inputFilePath = path.join(__dirname, '../videos/all_videos.json');

        // Read and parse JSON file
        const videosData = JSON.parse(fs.readFileSync(inputFilePath, 'utf-8'));

        // Insert documents into MongoDB
        await Video.insertMany(videosData);

        console.log(`Imported ${videosData.length} videos to MongoDB`);
    } catch (error) {
        console.error("Error importing videos from JSON:", error);
    } finally {
        mongoose.connection.close(); // Close connection after importing
    }
}
