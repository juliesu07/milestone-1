#!/bin/bash

# Base directory where the videos are located
VIDEO_BASE_DIR="./videos"

# Output directory
OUTPUT_DIR="./media"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Loop through each .mp4 file in the directory
for FULL_INPUT_PATH in "$VIDEO_BASE_DIR"/*.mp4; do
  # Get the filename without the directory path
  INPUT_FILE=$(basename "$FULL_INPUT_PATH")
  OUTPUT_PATH="$OUTPUT_DIR/$INPUT_FILE"

  echo "Processing $FULL_INPUT_PATH"

  ffmpeg \
    -i "$FULL_INPUT_PATH" \
    -vf "scale='if(gt(iw/ih,16/9),min(1280,iw),-2)':'if(gt(iw/ih,16/9),-2,min(720,ih))', \
         pad=1280:720:(1280-iw*min(1280/iw\,720/ih))/2:(720-ih*min(1280/iw\,720/ih))/2:black" \
    -map 0:v -b:v:0 254k -s:v:0 320x180 \
    -map 0:v -b:v:1 507k -s:v:1 320x180 \
    -map 0:v -b:v:2 759k -s:v:2 480x270 \
    -map 0:v -b:v:3 1013k -s:v:3 640x360 \
    -map 0:v -b:v:4 1254k -s:v:4 640x360 \
    -map 0:v -b:v:5 1883k -s:v:5 768x432 \
    -map 0:v -b:v:6 3134k -s:v:6 1024x576 \
    -map 0:v -b:v:7 4952k -s:v:7 1280x720 \
    -f dash -seg_duration 10 -use_template 1 -use_timeline 1 -adaptation_sets "id=0,streams=v" \
    -init_seg_name "${INPUT_FILE%.mp4}_init_\$RepresentationID\$.m4s" \
    -media_seg_name "${INPUT_FILE%.mp4}_chunk_\$Bandwidth\$_\$Number\$.m4s" \
    "${OUTPUT_PATH%.mp4}.mpd"

  echo "Processed $INPUT_FILE"
done
