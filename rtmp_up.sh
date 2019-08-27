#!/bin/bash

docker create --name srs -p 1935:1935 -p 1985:1985 -p 8080:8080 ossrs/srs:2.0
# Override the config used by the container
docker cp srs.conf srs:/srs/conf/docker.conf
docker start srs
