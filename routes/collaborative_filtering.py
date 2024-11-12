import redis
import json
import numpy as np
import random
from implicit.als import AlternatingLeastSquares
from scipy.sparse import csr_matrix
from pymongo import MongoClient
from bson import ObjectId


# Connect to Redis
redis_client = redis.StrictRedis(host='localhost', port=6379, db=0)

# Connect to MongoDB
mongo_client = MongoClient('mongodb://localhost:27017/')
db = mongo_client['milestone-1']

# user_id = ObjectId('673284dc9b55b05c1c76664b')
# print(users_collection.find_one({'_id': user_id}))

# Load or Update Collaborative Filtering Model
def load_user_video_data():
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
        print("Requested user index:", user_index)
    # Convert the matrix to a sparse format for efficiency

    return csr_matrix(user_video_matrix)

def recommend_videos(user_id_str, count):

    users_collection = db['users']
    videos_collection = db['videos']
    
    user_video_matrix = load_user_video_data()
    model = AlternatingLeastSquares(factors=10, regularization=0.1)
    model.fit(user_video_matrix.T)  # Training model on the transposed matrix

    # Convert user_id from string to ObjectId
    user_id = ObjectId(user_id_str)
    # Get the user's index and watched videos from the database
    user_data = users_collection.find_one({"_id": user_id})
    user_index = user_data.get("index")
    watched_videos = user_data.get("watched", [])
    

    # Generate initial recommendations based on collaborative filtering
    recommendations = model.recommend(user_index, user_video_matrix[user_index], N=count)

    # Fetch all videos from MongoDB and create the mapping of index to video ID
    videos = list(videos_collection.find())
    video_ids = [None] * (max(video['index'] for video in videos) + 1)

    # Populate the video_ids list such that video_ids[video_index] = video_id
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

# Listening for incoming requests from Node.js via Redis
while True:
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