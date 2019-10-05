import React, { Component } from "react";
import "./Room.css";

const mimeType = 'video/mp4; codecs="avc1.42001e, mp4a.67"';

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
        this.sourceBuffer.appendBuffer(event.data);
      }
      this.setState({
        lastMessageTime: performance.now()
      });
    };

    const videoSource = new MediaSource();
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
        <video autoPlay={false} ref={this.videoRef} className="video" />
      </div>
    );
  }
}
