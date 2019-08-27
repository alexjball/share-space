#!/bin/bash

# ffplay has significantly less latency than vlc
ffplay -probesize 32 -sync ext rtmp://35.185.85.44/triple/stream

