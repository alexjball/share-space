#!/bin/bash

ffmpeg -f x11grab \
    -video_size 1280x720 -framerate 30 -thread_queue_size 64 -i :1 \
    -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -s 640x360 \
    -threads 0 -f flv rtmp://localhost/triple/stream
