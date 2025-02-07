const express = require('express');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const app = express();

// MongoDB setup (using Mongoose as an example)
const User = require('../models/User'); // User model for MongoDB
const Video = require('../models/Video'); // Video model for MongoDB

mongoose.connect('mongodb://localhost:27017/milestone-1', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function getInteractions() {
    const users = await User.find({});
    const interactions = [];

    for (let i = 0; i < users.length; i++) {
        console.log(users[i].username);
        console.log(users[i].liked.length);
        for (let y = 0; y < users[i].liked.length; y++) {
            const video = await Video.findById(users[i].liked[y]);
            let interaction = {
                userId: users[i].id,
                itemId: video.id,
                rating: 5
            };
            interactions.push(interaction);
        }

        for (let y = 0; y < users[i].disliked.length; y++) {
            const video = await Video.findById(users[i].disliked[y]);
            let interaction = {
                userId: users[i].id,
                itemId: video.id,
                rating: 1
            };
            interactions.push(interaction);
        }
    }
    console.log(interactions);
    return interactions;
}

async function makeUserRecommendations(id, count) {
    // Dynamically import Recommender from disco-rec
    const { Recommender } = await import('disco-rec');
    const videos = await Video.find({});
    const user = await User.findById(id);
    
    const interactions = await getInteractions();
    if (interactions.length == 0)
    {
        const recommendations = [];
        const recommendedItemIds = new Set(recommendations.map(rec => rec.itemId.toString()));
        const watchedItemIds = new Set(user.watched.map(video => video._id.toString()));
        const likedItemIds = new Set(user.liked.map(video => video._id.toString()));

        while (recommendations.length < count)
        {
            const randomItem = videos[Math.floor(Math.random() * videos.length)];
            const randomItemId = randomItem._id;

            if(!recommendedItemIds.has(randomItemId.toString()) && !watchedItemIds.has(randomItemId.toString()) && !likedItemIds.has(randomItemId.toString()))
            {
                recommendations.push({ itemId: randomItemId.toString(), score: 0 }); 
                recommendedItemIds.add(randomItemId.toString());
            }
        }
        return recommendations;
    }

    const recommender = new Recommender();
    recommender.fit(interactions);
    
    const recommendationsFromMl = recommender.userRecs(id, count);
    const recommendedItemIds = new Set(recommendationsFromMl.map(rec => rec.itemId.toString()));
    const watchedItemIds = new Set(user.watched.map(video => video._id.toString()));
    const likedItemIds = new Set(user.liked.map(video => video._id.toString()));
    var recommendations = recommendationsFromMl;
    // console.log("before");
    // console.log(recommendations);
    const recFiltered = recommendations.filter((item) => !watchedItemIds.has(item.itemId));

    // console.log(recommendations);
    recommendations = recFiltered;
    // console.log(recFiltered);
    
    if (recommendations.length < count)
    {
        while (recommendations.length < count)
        {
            const randomItem = videos[Math.floor(Math.random() * videos.length)];
            const randomItemId = randomItem._id;

            if (!recommendedItemIds.has(randomItemId.toString()) && !watchedItemIds.has(randomItemId.toString()))// && !likedItemIds.has(randomItemId.toString()))
            {
                recommendations.push({ itemId: randomItemId.toString(), score: 0 }); 
                recommendedItemIds.add(randomItemId.toString());
            }
        }
    }
    return recommendations;
}

async function makeVideoRecommendations(videoId, userId, count) {
    // Dynamically import Recommender from disco-rec
    const { Recommender } = await import('disco-rec');
    console.log("count is " + count);
    console.log("video id " + videoId);
    console.log("user id " + userId);
    const videos = await Video.find({});
    const user = await User.findById(userId);

    // Fetch all interactions
    const interactions = await getInteractions();

    // Helper to filter random videos
    const getRandomUnwatchedVideos = (excludedIds, numVideos) => {
        const recommendations = [];
        while (recommendations.length < numVideos) {
            const randomItem = videos[Math.floor(Math.random() * videos.length)];
            const randomItemId = randomItem._id.toString();
            if (!excludedIds.has(randomItemId)) {
                recommendations.push({ itemId: randomItemId, score: 0 });
                excludedIds.add(randomItemId);
            }
        }
        return recommendations;
    };

    // If no interactions, return random recommendations
    if (interactions.length === 0) {
        const watchedItemIds = new Set(user.watched.map(video => video._id.toString()));
        const likedItemIds = new Set(user.liked.map(video => video._id.toString()));
        const excludedIds = new Set([...watchedItemIds, ...likedItemIds]);

        return getRandomUnwatchedVideos(excludedIds, count);
    }


    const fillRecommendationsWithLikedUnwatchedIds = (recommendations, likedUnwatchedIds, count) => {
        // Convert recom to an array for easier iteration
        const likedUnwatchedIdsArray = [...likedUnwatchedIds];
        
        for (let id of likedUnwatchedIdsArray) {
            if (recommendations.length >= count) break; // Stop if we've reached the desired size
            notDuplicate = true;

            for (let items of recommendations) { if (id == items.itemId) { notDuplicate = false; } }

            if (notDuplicate) recommendations.push({ itemId: id, score: 0 });
        }
    };

    // Train the recommender
    const recommender = new Recommender();
    recommender.fit(interactions);

    // Get recommendations from ML model
    let recommendations = recommender.itemRecs(videoId, count);
    
    console.log("these are the recommendations: ");
    console.log(recommendations);
    
    // Filter out watched videos
    const watchedItemIds = new Set(user.watched.map(video => video._id.toString()));
    const likedItemIds = new Set(user.liked.map(video => video._id.toString()));
    const likedUnwatchedItemIds = new Set([...likedItemIds].filter(id => !watchedItemIds.has(id)));

    // console.log(likedItemIds);
    const recommendedItemIds = new Set(recommendations.map(rec => rec.itemId.toString()));
    
    // This is to filter shit please remember ty
    recommendations = recommendations.filter(item => !watchedItemIds.has(item.itemId));
    console.log("these are the unwatched recommendations: ");
    console.log(recommendations);
    
    // This fills in with liked unwatched videos by the users
    fillRecommendationsWithLikedUnwatchedIds(recommendations, likedUnwatchedItemIds, count);
    console.log("these are the filledUnwatched recommendations: ");
    console.log(recommendations);

    // If we still need more recommendations, add random ones
    if (recommendations.length < count) {
        const excludedIds = new Set([...recommendedItemIds, ...watchedItemIds]);
        const additionalRecommendations = getRandomUnwatchedVideos(
            excludedIds,
            count - recommendations.length
        );
        recommendations = recommendations.concat(additionalRecommendations);
    }

    console.log("sent to grading script: ");
    console.log(recommendations);

    return recommendations;
}

// (async () => {
//     const recommendations = await makeVideoRecommendations('673fd0788d9bbd146821d2c6', '674002801088cb6f7947367c', 10);
//     console.log("Recommendations:", recommendations);
// })();

module.exports = {
    getInteractions,
    makeUserRecommendations,
    makeVideoRecommendations
};