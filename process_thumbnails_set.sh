#!/bin/bash

# Directories
VIDEO_DIR="./videos"        # Directory containing video files
OUTPUT_DIR="./thumbnails"   # Directory to save thumbnails

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Desired thumbnail dimensions
THUMBNAIL_WIDTH=320
THUMBNAIL_HEIGHT=180

# Iterate over each video file in the VIDEO_DIR
for video in "$VIDEO_DIR"/*; do
  # Check if the file is a video file (you can modify the extensions as needed)
  if [[ "$video" == *.mp4 || "$video" == *.mkv || "$video" == *.avi ]]; then
    # Extract the filename without extension
    filename=$(basename "$video")
    filename_without_ext="${filename%.*}"

    # Generate the thumbnail (first frame) with padding
    ffmpeg -i "$video" -ss 00:00:01.000 -vframes 1 -vf "scale='if(gt(iw/ih,$THUMBNAIL_WIDTH/$THUMBNAIL_HEIGHT),$THUMBNAIL_WIDTH,-1)':'if(gt(iw/ih,$THUMBNAIL_WIDTH/$THUMBNAIL_HEIGHT),-1,$THUMBNAIL_HEIGHT)',pad=$THUMBNAIL_WIDTH:$THUMBNAIL_HEIGHT:(ow-iw)/2:(oh-ih)/2" "$OUTPUT_DIR/${filename_without_ext}.jpg" -y

    if [ $? -eq 0 ]; then
      echo "Generated thumbnail for $filename"
    else
      echo "Failed to generate thumbnail for $filename"
    fi
  fi
done

echo "Thumbnail generation complete."