const mongoose = require('mongoose');
const path = require('path'); // Import path if needed for directories
const Video = require('../models/Video'); // Import your Video model
const videoData = require('../videos/m1.json');
const Counter = require('../models/Counter');
const fs = require('fs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/milestone-1', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch(error => {
    console.error("Error connecting to MongoDB:", error);
});

async function renameFiles() {
    try
    {
        const videos = await Video.find({});
        for (const video of videos)
        {
            const fileTitle = video.title;
            const videoId = video._id.toString();
    
            const oldFilePath = path.join(__dirname, '../videos', fileTitle);
            const newFilePath = path.join(__dirname, '../videos', `${videoId}.mp4`);
    
            if (fs.existsSync(oldFilePath))
            {
                try {
                    await fs.promises.rename(oldFilePath, newFilePath);
                    console.log(`Renamed '${fileTitle}' to '${videoId}'`);
                } catch (err) {
                    console.error(`Error renaming '${fileTitle}':`, err);
                }
            }
            else
            {
                console.log(`File '${fileTitle}' not found in folder`);
            }
        }
    }
    catch(err)
    {
        console.error('Error connecting to MongoDB or renaming files: ', err);
    }
}
renameFiles();