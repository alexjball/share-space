# Work Items
- Audio support: Add a null audio sink, set it to the default audio sink, and stream the monitor output
- Quality: Run on an upgraded machine type: 1080p 30 fps video (and audio)
- Usability: Use Xvfb and x11vnc to support headless (vnc-clientless) configurations
- Usability: Add a web UI for viewing the stream, grabbing control, and passing mouse/keyboard input to the session. 

# Deployed Software Configuration

VNC passes user input to the remote machine, and the remote machine passes framebuffers to the user.

- VM - Control process
    - X11 servers, 1 per room, each instance is an X session
        - PulseAudio Server with null-sink input
        - Browser (X11 client)
    - VNC servers, 1 per X server
    - ffmpeg streams, 1 per X server
    - RTMP service, either a local process or cluster.

There are two options for how to handle X sessions:
1. Start virtual X sessions with Xvfb, use x11vnc to control the session, and use an ffmpeg stream to record.
2. Use TigerVNC to control the session and start an ffmpeg stream to record the X session started by TigerVNC.

2 is better if the X displays created by TigerVNC can actually be recorded by ffmpeg. TigerVNC also gives us session management for free. So 2 has smoother UX if we don't have a web UI and control server running in the VM. A simple web UI isn't that complicated (2 days of coding, N days of docs). So we'll go with approach 1 for MVP and approach 2 for demonstrating the tech choices (VNC, ffmpeg, RTMP).

# Demo (Option 2)

- Start the rtmp server
- To start a new session, run vncserver to start a new X session and vnc endpoint.
    - Configure VNC session password
    - Configure Stream resolution, name, and password
    - Configure Desktop environment: Cinnamon with a chrome/firefox browser
- Set up SSH tunneling for the vnc server
- Access the session using a VNC client over the tunnel.
- Start streaming with ffmpeg

Automating the above necessarily involves building a UI to hold the user-facing parts.

The X window buffer is only updated while the vnc client is connected, so the controller needs to keep the window open.

## Latency

Latency due to RTMP is [minimized](https://github.com/ossrs/srs/wiki/v1_EN_LowLatency), < 1s.

Using `-preset ultrafast -tune zerolatency` with [ffmpeg](https://trac.ffmpeg.org/wiki/StreamingGuide) also helps.

VLC introduces a huge amount of delay (10's of seconds). Using `ffplay` is much better.

With these, latency is less than 2 seconds, which is actually usable. 

We can render the user's live mouse location in the browser window over the mouse in the video stream to
convey the latency to the user.

# MVP (Option 1)

The MVP consists of a single-machine deployment capable of streaming HD video to several people. There is a simple landing page with a control pane to start a room. This will be hosted on my local machine. Starting a room starts a VM, which will initialize VNC, RTMP, and the stream. The control pane displays open rooms and a link to open the room, keyed on the room ID.

The room environment is a single page app. The client reads its ID from the URL then uses the page API to access the stream given that ID. The API endpoint to use is built into the html for the given host domain.

noVNC is attached to a transparent div that fills the viewport. It receives touch and mouse events but does not deliver video. 

video.js is attached to a sibling div that also fills the viewport and provides audio/video. It is important for this to match the size of the noVNC div so the pointer translates correctly.

When the client starts, it connects to the room API and starts the RTMP server. If there are no other participants, it also tries to start the VNC connection. The vnc server should reject

- Session that people can join
- Everyone sees the RTMP stream.
    - RTMP streams are played using flash. [Video.js](https://github.com/videojs/video.js/) is a popular library that supports flash. 
- The controlling user controls the VNC session with their keyboard and mouse.
    - Use a web VNC client to pass input. [noVNC](https://github.com/novnc/noVNC) is a popular solution. Note that noVNC requires the VNC server to support websockets. x11vnc [supports](https://meta.caspershire.net/novnc-with-x11vnc/) this, but tigervnc does not. 
    - Do *not* render the VNC video stream; the controlling user continues to see the low-latency RTMP stream. The whole experience sucks with high latency so it's safe to treat the RTMP stream as low-latency in design. This also nicely decouples the video player from the VNC client.
 
## API
`DashboardService` is used to display active rooms the user can see and to create new rooms. Rooms have unique ID's and each room logically corresponds to a `RoomService` instance.

```
- DashboardService @ root/DashboardService
	- CreateRoom
	- DeleteRoom
	- ListRooms
- Room
	- id: String
	- RoomService root URL: String
	- RTMP stream URL: String
	- VNC URL: String
- RoomService @ RoomServiceRoot/RoomService
	- GetConfiguration: Returns the room object and status of the assembly
	- GetVncToken: Returns a token to allow connecting to the VNC endpoint.
```
Use [Flask Principal](https://pythonhosted.org/Flask-Principal/) for resource access control.

The Dashboard implementation needs to start room instances somehow. In a production deployment, this could be a Kubernetes API call to deploy a room. To keep things simple, the MVP implementation will just make Docker client calls to start the room.

For MVP we'll only ever have a single room instance, but we structure it this way to ensure the code we write now is compatible with a production deployment in the future.

## Room instances with Docker compose
- Xvfb container
- x11vnc container
	- Accesses Xvfb's X socket
	- Run with -nofb to process only mouse and keyboard
	- connection endpoint is localhost only. The controlling client needs to use ssh forwarding or on the same machine. Could also open it up to LAN connections.
- ffmpeg container
	- Accesses Xvfb's X socket
	- Pushes to rtmp
- rtmp container
	- rtmp endpoint is publicly accessible
	- 

It might be tricky/inefficient getting the container to pass the X socket around. I can just install everything on the VM and run the scripts.

# Productionizing

## Scale

For the triple use case, a single host deployment should work fine. For a streaming-box-as-a-service business, services will be distributes differently. At that scale, we should use Kubernetes and Dockerized services.

**Complexity increases with scale** so there isn't a reason to use Kub until after the MVP. Docker could be useful on a single machine for dependency management and reproducibility. 

Even with the MVP web UI, I'll need something to host it until the VM is started, so I'm already multi-machine. 

## Security

To what extent can we limit the controlling user's ability to compromise the X session? Can VNC do that out of the box? This is only a concern in a product deployment, which also implies a multi-host deployment where the RTMP server is separate. 
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTcwMTg5Mzc3MywtMTM3MTc2MzIyMSwtMT
YyNjgwNTQ4NiwxMTQ2OTEyMDY2LC05MDQyNzMxNDNdfQ==
-->