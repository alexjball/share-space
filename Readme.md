[![Build Status](https://travis-ci.com/alexjball/share-space.svg?branch=master)](https://travis-ci.com/alexjball/share-space)

[Demo video](https://alexjball.github.io/share-space/demo.html)

[Background and design decisions](https://alexjball.com/video-streaming/share-space/)

To run a Share Space instance, see [Share Space Host](https://github.com/alexjball/share-space-host)

# Share Space

Make it easy to share a computer remotely with others. Spend less time fiddling with gadgets and more time with people.

Features:
- Movie-quality (1080p30) remote desktop screen and audio capture
- Persistent and customizable desktop environment
- Live video stream supports many simultaneous viewers
- Pass remote keyboard and mouse control between viewers
- Low end-to-end latency (1-4 s).
- Passcode and third-party auth
- Full VNC access over LAN

# TODO
- Add mouse/keyboard control via noVNC
- Research discord bot: accept requests for new rooms, start and report status, set up discord auth, command for modifying access list.
- Add timing information to webm_streaming_chunk
- refactor webm_streaming_chunk to webm_media_source and attempt to merge upstream
- Implement third-party (chatbot automated) auth
- Set up CD to Vagrant hub for the host project
- Set up CI for the environment: test that stack works and that video streams
- Set up a deploy configuration with static client files
- Fix Firefox compatibility
- Optimize mobile layout
- Create a new non-admin user to run the GUI
- Reaserch using video.js for player: Can it be integrated with our websocket transport?
