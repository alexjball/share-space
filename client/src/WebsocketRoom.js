import React, { Component } from "react";
import "./Room.css";

// const mimeType = 'video/mp4; codecs="avc1.42001e, mp4a.67"';
const mimeType = 'video/webm; codecs="vp9"';//,vorbis"';

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
        const tr = this.sourceBuffer.buffered;
        const printTr = (tr) => {
          if (tr.length) {
            return `${tr.start(0)} ${tr.end(0)}`;
          }
          return "empty TimeRanges";
        };
        if (this.videoRef.current.error) {
          console.log(this.videoRef.current.error);
        }
        if (tr.length && this.videoRef.current) {
          console.log(printTr(tr), this.videoRef.current.currentTime, printTr(this.videoRef.current.seekable));
        }
        // console.log(this.sourceBuffer.buffered.start(0), this.sourceBuffer.buffered.end(0));
        if (this.sourceBuffer.updating) {
          console.warn("sourceBuffer is updating, aborting");
          this.sourceBuffer.abort();
        }
        this.sourceBuffer.appendBuffer(event.data);
      }
      this.setState({
        lastMessageTime: performance.now()
      });
    };

    const videoSource = (this.videoSource = new MediaSource());
    videoSource.addEventListener("sourceopen", () => {
      this.sourceBuffer = videoSource.addSourceBuffer(mimeType);
    });

    this.videoRef.current.src = URL.createObjectURL(videoSource);
  }

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
