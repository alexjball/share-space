#!/bin/bash

sudo docker stop srs

kill $(pgrep x11vnc)
kill $(pgrep Xvfb)
kill $(pgrep ffmpeg)

