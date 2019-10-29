[![Build Status](https://travis-ci.com/alexjball/share-space.svg?branch=master)](https://travis-ci.com/alexjball/share-space)

https://github.com/alexjball/share-space-host

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
- Add /control endpoint: clients try to connect, and the server authenticates it. If the requester is allowed, the connection is accepted and VNC control works. This endpoint should not be left unprotected, since it gives the requester control of the desktop.
- Research discord bot: accept requests for new rooms, start and report status, set up discord auth, command for modifying access list.
- Add timing information to webm_streaming_chunk
- refactor webm_streaming_chunk to webm_media_source and attempt to merge upstream
- Add generic auth flow with session cookies
- Implement passcode (manually distributed) auth
- Implement third-party (chatbot automated) auth
- Set up CD to Vagrant hub for the host project
- Set up CI for the environment: test that stack works and that video streams
