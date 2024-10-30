
#!/bin/bash

# Directory where videos are stored
VIDEO_DIR="./videos"
OUTPUT_DIR="./output"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Iterate over each video in the VIDEO_DIR
for video in "$VIDEO_DIR"/*.mp4; do
    # Get the base name of the video file (e.g., "10040768-hd_1920_1080_24fps")
    base_name=$(basename "$video" .mp4)

    # Set output manifest file path
    output_mpd="$OUTPUT_DIR/$base_name.mpd"

    # Run FFmpeg to create DASH manifest with multiple resolutions and bitrates
    ffmpeg \
       -i "$video" \
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
        -init_seg_name "${base_name}_init_\$RepresentationID\$.m4s" \
        -media_seg_name "${base_name}_chunk_\$Bandwidth\$_\$Number\$.m4s" \
        "$output_mpd"

    echo "Generated DASH manifest for $video -> $output_mpd"
done

echo "Processing complete. All DASH files saved in $OUTPUT_DIR."
