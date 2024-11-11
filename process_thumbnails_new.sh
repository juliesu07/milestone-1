#!/bin/bash

# Base directory where the videos are located
VIDEO_BASE_DIR="./videos"

# Output directory for thumbnails
THUMBNAIL_DIR="./thumbnails"

# Create output directory if it doesn't exist
mkdir -p "$THUMBNAIL_DIR"

# Desired thumbnail dimensions
THUMBNAIL_WIDTH=320
THUMBNAIL_HEIGHT=180

# Loop through each .mp4 file in the directory
for FULL_INPUT_PATH in "$VIDEO_BASE_DIR"/*.mp4; do
  # Get the filename without the directory path
  INPUT_FILE=$(basename "$FULL_INPUT_PATH")

  echo "Processing $INPUT_FILE"

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
