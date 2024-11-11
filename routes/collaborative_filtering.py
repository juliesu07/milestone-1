import redis
import json
import numpy as np
from implicit.als import AlternatingLeastSquares
from scipy.sparse import csr_matrix
from pymongo import MongoClient

# Connect to Redis
redis_client = redis.StrictRedis(host='localhost', port=6379, db=0)

# Connect to MongoDB
mongo_client = MongoClient('mongodb://localhost:27017/')
db = mongo_client['milestone-1']
users_collection = db['users']
videos_collection = db['videos']

# Load or Update Collaborative Filtering Model
def load_user_video_data():
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

    # Convert the matrix to a sparse format for efficiency
    return csr_matrix(user_video_matrix)