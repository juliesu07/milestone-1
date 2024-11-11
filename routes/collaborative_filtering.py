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
db = mongo_client['videoApp']
users_collection = db['users']
videos_collection = db['videos']