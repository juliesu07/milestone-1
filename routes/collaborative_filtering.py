import redis
import json
import numpy as np
import random
from implicit.als import AlternatingLeastSquares
from scipy.sparse import csr_matrix
from pymongo import MongoClient
from bson import ObjectId
import traceback

# Connect to Redis
redis_client = redis.StrictRedis(host='localhost', port=6379, db=0)

# Connect to MongoDB
mongo_client = MongoClient('mongodb://localhost:27017/')
db = mongo_client['milestone-1']

# Load or Update Collaborative Filtering Model
def load_user_video_data():
    try:
        users_collection = db['users']
        videos_collection = db['videos']
        # Fetch all users and videos from MongoDB
        users = list(users_collection.find())
        videos = list(videos_collection.find())

        # Determine the number of users and videos
        num_users = max(user['index'] for user in users) + 1
        num_videos = max(video['index'] for video in videos) + 1

        # Initialize the user-video interaction matrix with zeros
        user_video_matrix = np.zeros((num_users, num_videos))

        for user in users:
            user_index = user['index']
            # Set liked videos to 1
            for video_id in user.get('liked', []):
                video = videos_collection.find_one({'_id': video_id})
                if video:
                    video_index = video['index']
                    user_video_matrix[user_index, video_index] = 1

            # Set disliked videos to -1
            for video_id in user.get('disliked', []):
                video = videos_collection.find_one({'_id': video_id})
                if video:
                    video_index = video['index']
                    user_video_matrix[user_index, video_index] = -1

        print("Shape of user_video_matrix:", user_video_matrix.shape)
        return csr_matrix(user_video_matrix)

    except Exception as e:
        print("Error in load_user_video_data:", str(e))
        traceback.print_exc()
        return None

def recommend_videos(user_id_str, count):
    try:
        users_collection = db['users']
        videos_collection = db['videos']
        
        user_video_matrix = load_user_video_data()
        if user_video_matrix is None:
            raise ValueError("user_video_matrix could not be loaded or is empty.")
        
        print("Shape of user_video_matrix:", user_video_matrix.shape)

        model = AlternatingLeastSquares(factors=10, regularization=0.1)
        model.fit(user_video_matrix.T)  # Training model on the transposed matrix

        # Convert user_id from string to ObjectId
        user_id = ObjectId(user_id_str)
        user_data = users_collection.find_one({"_id": user_id})
        if not user_data:
            raise ValueError(f"User with ID {user_id_str} not found in database.")
        
        user_index = user_data.get("index")
        watched_videos = user_data.get("watched", [])
        
        # Generate initial recommendations based on collaborative filtering
        N = min(count, user_video_matrix.shape[1])
        print("Generating recommendations for user index:", user_index)

        try:
            recommendations = model.recommend(user_index, user_video_matrix[user_index], N=N)
        except IndexError as ie:
            print("IndexError during recommendation generation:", str(ie))
            traceback.print_exc()
            return []
        
        # Fetch all videos from MongoDB and map indices to video IDs
        videos = list(videos_collection.find())
        video_ids = [None] * (max(video['index'] for video in videos) + 1)
        for video in videos:
            video_ids[video['index']] = video['_id']

        # Extract video IDs from recommendations, excluding already watched videos
        recommended_video_ids = [
            video_ids[int(rec[0])] for rec in recommendations
            if video_ids[int(rec[0])] not in watched_videos
        ]

        # Add additional unwatched/random videos if needed to reach the requested count
        if len(recommended_video_ids) < count:
            unwatched_videos = [vid for vid in video_ids if vid not in watched_videos]
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
                "liked": video["_id"] in user_data.get("liked", []),
                "likevalues": video["like"]
            }
            for video in videos_collection.find({"_id": {"$in": recommended_video_ids}})
        ]

        return video_details

    except Exception as e:
        print("Error in recommend_videos:", str(e))
        traceback.print_exc()
        return []

# Listening for incoming requests from Node.js via Redis
while True:
    try:
        _, request = redis_client.blpop("recommendation_queue")
        request_data = json.loads(request)
        
        # Extract request details
        request_id = request_data["requestId"]
        user_id = request_data["userId"]
        count = request_data["count"]
        
        # Generate recommendations
        recommended_videos = recommend_videos(user_id, count)
        
        # Send response back to Node.js via Redis
        response_key = f"recommendation_response_{request_id}"
        redis_client.rpush(response_key, json.dumps({"videos": recommended_videos}))
    except Exception as e:
        print("Error processing request from Node.js:", str(e))
        traceback.print_exc()
