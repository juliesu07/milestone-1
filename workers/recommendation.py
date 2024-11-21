import traceback
from bson import ObjectId
from flask import Flask, jsonify, request
from pymongo import MongoClient
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import redis
import json
import random

app = Flask(__name__)

# MongoDB connection setup
client = MongoClient("mongodb://localhost:27017/")
db = client['milestone-1']

# Redis connection setup
redis_client = redis.StrictRedis(host='localhost', port=6379, db=0)

def get_user_video_matrix():
    users_collection = db['users']
    videos_collection = db['videos']
    
    # Fetch all users and videos from MongoDB
    users = list(users_collection.find())
    videos = list(videos_collection.find())

    num_users = len(users)
    num_videos = len(videos)

    # Initialize a user-video matrix with zeros (no interaction)
    user_video_matrix = np.zeros((num_users, num_videos))

    # Create a mapping of video ID to index
    video_id_to_index = {video['_id']: video['index'] for video in videos}

    # Fill the matrix with interactions (1 for liked, -1 for disliked)
    for user_index, user in enumerate(users):
        # Set liked videos to 1 (Implicit feedback)
        for video_id in user.get('liked', []):
            video_index = video_id_to_index.get(video_id)
            if video_index is not None:
                user_video_matrix[user_index, video_index] = 1

        # Set disliked videos to -1 (Implicit feedback)
        for video_id in user.get('disliked', []):
            video_index = video_id_to_index.get(video_id)
            if video_index is not None:
                user_video_matrix[user_index, video_index] = -1

    return user_video_matrix, users, videos

def recommend_videos(user_id_str, count):
    try:
        users_collection = db['users']
        videos_collection = db['videos']
        
        # Load the user-video interaction matrix
        user_video_matrix, users, videos = get_user_video_matrix()  # Assuming you use the updated `get_user_video_matrix` function
        
        if user_video_matrix is None or len(user_video_matrix) == 0:
            raise ValueError("user_video_matrix could not be loaded or is empty.")
        
        print("Shape of user_video_matrix:", user_video_matrix.shape)

        # Convert user_id from string to ObjectId
        user_id = ObjectId(user_id_str)
        user_data = users_collection.find_one({"_id": user_id})
        if not user_data:
            raise ValueError(f"User with ID {user_id_str} not found in database.")
        
        user_index = user_data.get("index")
        watched_videos = [vid for vid in user_data.get("watched", [])]
        liked_videos = [vid for vid in user_data.get("liked", [])]
        disliked_videos = [vid for vid in user_data.get("disliked", [])]

        print(f"Generating recommendations for user index: {user_index}")

        # Calculate cosine similarity between the user's interaction vector and all video vectors
        user_interaction_vector = user_video_matrix[user_index].reshape(1, -1)  # Target user interaction vector
        similarity_scores = cosine_similarity(user_interaction_vector, user_video_matrix)[0]  # Similarity to all users
        
        # Sort the videos based on similarity scores (highest first)
        top_indices = np.argsort(similarity_scores)[::-1][:count]
        
        # Fetch all videos from MongoDB and map indices to video IDs
        videos = list(videos_collection.find())
        video_ids = [None] * (max(video['index'] for video in videos) + 1)
        for video in videos:
            video_ids[video['index']] = video['_id']
        
        # Extract video IDs from recommendations, excluding already watched and disliked videos
        recommended_video_ids = [
            video_ids[idx] for idx in top_indices
            if video_ids[idx] not in watched_videos and video_ids[idx] not in disliked_videos
        ]
        
        # Add additional unwatched/random videos if needed to reach the requested count
        if len(recommended_video_ids) < count:
            unwatched_videos = [ObjectId(vid) for vid in video_ids if vid not in watched_videos and vid not in disliked_videos]
            random_videos = random.sample(unwatched_videos, min(count - len(recommended_video_ids), len(unwatched_videos)))
            recommended_video_ids.extend(random_videos)

            # If still not enough, add random watched videos to fill
            if len(recommended_video_ids) < count:
                additional_videos = random.sample(watched_videos, count - len(recommended_video_ids))
                recommended_video_ids.extend(additional_videos)

        # Retrieve video details from the database
        video_details = [
            {
                "id": str(video["_id"]),
                "description": video["description"],
                "title": video["title"],
                "watched": video["_id"] in watched_videos,
                "liked": video["_id"] in liked_videos,
                "likevalues": video["like"]
            }
            for video in videos_collection.find({"_id": {"$in": recommended_video_ids}})
        ]

        return video_details

    except Exception as e:
        print(f"Error generating video recommendations: {str(e)}")
        return []

# Redis listening loop
while True:
    try:
        # Listen for incoming requests from the Redis queue
        _, request = redis_client.blpop("recommendation_queue")
        request_data = json.loads(request)

        # Extract request details
        request_id = request_data["requestId"]
        user_id = request_data["userId"]
        count = request_data["count"]

        # Generate recommendations
        recommended_videos = recommend_videos(user_id, count)
        # print(recommended_videos['videos'])

        # Send response back to Node.js via Redis
        response_key = f"recommendation_response_{request_id}"
        redis_client.rpush(response_key, json.dumps({"videos": recommended_videos}))

    except Exception as e:
        print("Error processing request from Node.js:", str(e))
        traceback.print_exc()
