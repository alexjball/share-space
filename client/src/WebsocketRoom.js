import React, { Component } from "react";
import "./Room.css";

// Must match the video stream from the room server, as encoded by FFmpeg.
const mimeType = 'video/webm; codecs="vp9,opus"';

/**
 * The main interface to spaces, using a websocket.
 *
 * - Maintains a websocket ocnnection to the space server.
 * - Displays the desktop stream
 * - Captures user input for remote desktop control
 */
export default class WebsocketRoom extends Component {
  constructor(props) {
    super(props);
    this.state = { status: "Waiting to connect" };
    this.videoRef = React.createRef();
    this.pendingBuffers = [];

    if (!MediaSource.isTypeSupported(mimeType)) {
      throw Error(`MIME type ${mimeType} not supported`);
    }
  }

  async connect() {
    const ws = (this.ws = new WebSocket(`ws://${this.props.spaceUrl}/stream`));
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      this.setState({ status: "Connected" });
    };
    ws.onerror = event => {
      this.setState({ status: `Error: ${event}` });
    };
    ws.onclose = event => {
      this.setState({ status: "Closed" });
    };
    ws.onmessage = event => {
      if (this.sourceBuffer) {
        this.logPlayback(this.videoRef.current);
        this.pendingBuffers.push(event.data);
        this.tryAppendBuffer();
      } else {
        console.log("no sourceBuffer yet");
      }
      this.setState({
        lastMessageTime: performance.now()
      });
    };

    const videoSource = (this.videoSource = new MediaSource());
    videoSource.addEventListener("sourceopen", () => {
      this.sourceBuffer = videoSource.addSourceBuffer(mimeType);
      this.sourceBuffer.onupdate = this.tryAppendBuffer;
    });

    this.videoRef.current.src = URL.createObjectURL(videoSource);
  }

  logPlayback(video) {
    if (video.error) {
      console.error(this.videoRef.current.error);
    }

    const bufferedRanges = [];
    let i;
    for (i = 0; i < video.buffered.length; i++) {
      bufferedRanges.push([video.buffered.start(i), video.buffered.end(i)]);
    }

    console.log(
      `Current playback time: ${
        video.currentTime
      }. Available seek ahead: ${(video.seekable.length
        ? video.seekable.end(0)
        : 0) - video.currentTime}, # pending buffers: ${
        this.pendingBuffers.length
      }. Buffered ranges: ${bufferedRanges}. MediaSource duration: ${
        this.videoSource.duration
      }`
    );
  }

  // TODO: Seek to latest time if more than 5 seconds behind
  // TODO: Every 10 seconds, remove old buffers
  tryAppendBuffer = () => {
    if (this.sourceBuffer.updating) {
      console.warn("sourcebuffer is updating, not appending");
    } else {
      const buffer = this.pendingBuffers.shift();
      if (buffer) {
        this.sourceBuffer.appendBuffer(buffer);
      }
    }
  };

  componentDidMount() {
    if (this.props.spaceUrl) {
      this.connect();
    }
  }

  componentWillUnmount() {
    if (this.props.spaceUrl) {
      this.ws.close();
    }
  }

  render() {
    return (
      <div className="room">
        <div>{`spaceUrl: ${this.props.spaceUrl}`}</div>
        <div>{`status: ${this.state.status}`}</div>
        <div>{`latest message time: ${this.state.lastMessageTime}`}</div>
        <video autoPlay={true} ref={this.videoRef} className="video" />
        <button
          onClick={() => {
            this.videoRef.current.play();
          }}
        >
          Play
        </button>
      </div>
    );
  }
}
