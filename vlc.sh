#!/bin/bash

# Can access an HLS version at http://localhost:8080/myapp/video.m3u8 after installing
# an HLS player browser extension (Native HLS Playback in Chrome)
vlc -vvv rtmp://35.185.85.44/triple/stream

# Our public IP
# vlc -vvv rtmp://209.6.205.171/triple/stream
