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
        const inputFilePath = path.join(__dirname, 'all_videos.json');

        // Read and parse JSON file
        const videosData = JSON.parse(fs.readFileSync(inputFilePath, 'utf-8'));

        console.log(videosData);

        // Clear existing collection to avoid duplicate _id errors (optional)
        await Video.deleteMany({});

        // Insert documents into MongoDB with matching _id values
        await Video.insertMany(videosData, { ordered: true });

        console.log(`Imported ${videosData.length} videos to MongoDB with matching IDs`);
    } catch (error) {
        console.error("Error importing videos from JSON:", error);
    } finally {
        mongoose.connection.close(); // Close connection after importing
    }
}
