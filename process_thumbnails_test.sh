#!/bin/bash

# Path to your JSON file
JSON_FILE="./videos/m1.json"

# Base directory where the videos are located
VIDEO_BASE_DIR="./videos"

# Output directory for thumbnails
THUMBNAIL_DIR="./thumbnails"

# Create output directory if it doesn't exist
mkdir -p "$THUMBNAIL_DIR"

# Read video names from the JSON file
video_names=$(jq -r 'keys[]' "$JSON_FILE")

# Desired thumbnail dimensions
THUMBNAIL_WIDTH=320
THUMBNAIL_HEIGHT=180

# Loop through each video name
for INPUT_FILE in $video_names; do
  echo "Processing $INPUT_FILE"
  
  # Construct the full path to the video file
  FULL_INPUT_PATH="$VIDEO_BASE_DIR/$INPUT_FILE"
  
  # Define the output path for the thumbnail
  THUMBNAIL_PATH="$THUMBNAIL_DIR/${INPUT_FILE%.mp4}.jpg"

  # Use ffmpeg to create a thumbnail
  ffmpeg \
      -i "$FULL_INPUT_PATH" \
    -ss 00:00:00.000 \
    -vframes 1 \
    -vf "scale='if(gt(iw/ih,$THUMBNAIL_WIDTH/$THUMBNAIL_HEIGHT),$THUMBNAIL_WIDTH,-1)':\
    'if(gt(iw/ih,$THUMBNAIL_WIDTH/$THUMBNAIL_HEIGHT),-1,$THUMBNAIL_HEIGHT)',\
    pad=$THUMBNAIL_WIDTH:$THUMBNAIL_HEIGHT:(ow-iw)/2:(oh-ih)/2" "$THUMBNAIL_PATH" -y

  echo "Generated thumbnail for $INPUT_FILE at $THUMBNAIL_PATH"
done
