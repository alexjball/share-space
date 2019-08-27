#!/bin/bash 

# Runs services for a room
# - xvfb X session
# - x11vnc VNC control
# - SRS RTMP server
# - ffmpeg streaming X framebuffer

stop_room() {
  sudo docker stop srs &> /dev/null
  kill $(pgrep x11vnc) &> /dev/null
  kill $(pgrep Xvfb) &> /dev/null
  kill $(pgrep ffmpeg) &> /dev/null
}
trap "stop_room" EXIT

echo "Usage: ./run_room.sh width height fps"

FFMPEG_THREADS=7
DISPLAY_NUM=0
DIR=$(dirname $0)
export XAUTHORITY="$DIR/.$0.XAuthority"
ERR="$DIR/.$0.xvfb-run-err"

xvfb-run -e $ERR -f $XAUTHORITY \
	--server-num=$DISPLAY_NUM --server-args="-screen -0 $1x$2x24" firefox -width $1 -height $2 &

x11vnc -display :$DISPLAY_NUM -localhost -nevershared -forever &

sudo docker stop srs
sudo docker create --rm --name srs -p 1935:1935 -p 1985:1985 -p 8080:8080 ossrs/srs:2.0
# Override the config used by the container
sudo docker cp srs.conf srs:/srs/conf/docker.conf
sudo docker start srs

# Run the last command in the foreground, press q or ctrl-c to end the room
# Audio input should be listed first. It loads fast and for some reason reduces skew
ffmpeg \
    -f pulse -channels 2 -thread_queue_size 64 -i default \
    -f x11grab \
    -probesize 50000000 -video_size $1x$2 -framerate $3 -thread_queue_size 64 -i :$DISPLAY_NUM \
    -c:a aac -b:a 240k -ar 48000 \
    -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -s $1x$2 \
    -threads $FFMPEG_THREADS -f flv rtmp://localhost/triple/stream
