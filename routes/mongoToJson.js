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
    exportVideosToJSON();
})
.catch(error => {
    console.error("Error connecting to MongoDB:", error);
});

// Function to export all video documents to a JSON file
async function exportVideosToJSON() {
    try {
        // Fetch all documents from the Videos collection
        const videos = await Video.find({});
        
        // Convert documents to JSON format
        const videosData = JSON.stringify(videos, null, 2); // 2-space indentation for readability
        
        // Define output file path
        const outputFilePath = path.join(__dirname, 'all_videos.json');
        
        // Write JSON data to file
        fs.writeFileSync(outputFilePath, videosData);
        
        console.log(`Exported ${videos.length} videos to ${outputFilePath}`);
    } catch (error) {
        console.error("Error exporting videos to JSON:", error);
    } finally {
        mongoose.connection.close(); // Close connection after exporting
    }
}
