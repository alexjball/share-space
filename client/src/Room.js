import React, { Component } from "react";
import "./Room.css";
import ConnectionClient from "./connectionClient.js";

/**
 * The main interface to spaces.
 *
 * - Maintains a webRTC connection to the space server
 * - Displays the desktop stream
 * - Captures user input for remote desktop control
 */
export default class Room extends Component {
  constructor(props) {
    super(props);
    this.state = { status: "Waiting to connect", playState: "Stopped" };
    this.localVideoRef = React.createRef();
    this.remoteVideoRef = React.createRef();
  }

  async connect() {
    const response = await fetch(`${this.props.spaceUrl}/connect`),
      body = await response.json();

    if (response.ok) {
      return `Connected, offer: ${body.offer}`;
    }
    return `Failed to connect, ${response.status}`;
  }

  componentDidMount() {
    // open webRTC connection
    if (this.props.spaceUrl) {
      this.connect()
        .then(status => this.setState({ status }))
        .catch(reason => this.setState({ status: String(reason) }));
      this.connectionClient = new ConnectionClient({
        host: this.props.spaceUrl,
        prefix: "/rtc"
      });
    }
  }

  componentWillUnmount() {
    // close webRTC connection
  }

  beforeAnswer = async peerConnection => {
    this.localVideoRef.current.play();
    const localStream = this.localVideoRef.current.captureStream();
    localStream
      .getTracks()
      .forEach(track => peerConnection.addTrack(track, localStream));

    const remoteStream = new MediaStream(
      peerConnection.getReceivers().map(receiver => receiver.track)
    );
    this.remoteVideoRef.current.srcObject = remoteStream;

    remoteStream
      .getTracks()
      .forEach(track =>
        console.log(
          track.getSettings(),
          track.getCapabilities(),
          track.getConstraints()
        )
      );

    // NOTE(mroberts): This is a hack so that we can get a callback when the
    // RTCPeerConnection is closed. In the future, we can subscribe to
    // "connectionstatechange" events.
    const { close } = peerConnection;
    peerConnection.close = args => {
      this.remoteVideoRef.current.srcObject = null;

      this.localVideoRef.current.pause();

      localStream.getTracks().forEach(track => track.stop());

      return close.apply(peerConnection, args);
    };
  };

  start = async () => {
    this.setState({ playState: "Started" });
    try {
      this.peerConnection = await this.connectionClient.createConnection({
        beforeAnswer: this.beforeAnswer
      });
      window.peerConnection = this.peerConnection;
    } catch (error) {
      throw error;
    }
  };

  stop = async () => {
    this.setState({ playState: "Stopped" });
    try {
      this.peerConnection.close();
    } catch (error) {
      console.log(error);
      throw error;
    }
  };

  render() {
    return (
      <div className="room">
        <div>
          {`spaceUrl: ${this.props.spaceUrl} status: ${this.state.status}`}
        </div>
        <div className="video-container">
          <video
            loop={true}
            muted={true}
            ref={this.localVideoRef}
            className="video"
            src="/assets/earth.mp4"
          />
          <video
            autoPlay={true}
            muted={true}
            ref={this.remoteVideoRef}
            className="video"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={this.start}
            disabled={this.state.playState === "Started"}
          >
            Start
          </button>
          <button
            onClick={this.stop}
            disabled={this.state.playState === "Stopped"}
          >
            Stop
          </button>
        </div>
      </div>
    );
  }
}
