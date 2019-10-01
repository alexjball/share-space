import React, { Component } from "react";
import "./Room.css";

const DefaultRTCPeerConnection = RTCPeerConnection;
const TIME_TO_HOST_CANDIDATES = 3000;  // NOTE(mroberts): Too long.

export class ConnectionClient {
  constructor(options = {}) {
    options = {
      RTCPeerConnection: DefaultRTCPeerConnection,
      clearTimeout,
      host: '',
      prefix: '.',
      setTimeout,
      timeToHostCandidates: TIME_TO_HOST_CANDIDATES,
      ...options
    };

    const {
      RTCPeerConnection,
      prefix,
      host
    } = options;

    this.createConnection = async (options = {}) => {
      options = {
        beforeAnswer() {},
        stereo: false,
        ...options
      };

      const {
        beforeAnswer,
        stereo
      } = options;

      const response1 = await fetch(`${host}${prefix}/connections`, {
        method: 'POST'
      });

      const remotePeerConnection = await response1.json();
      const { id } = remotePeerConnection;

      const localPeerConnection = new RTCPeerConnection({
        sdpSemantics: 'unified-plan'
      });

      // NOTE(mroberts): This is a hack so that we can get a callback when the
      // RTCPeerConnection is closed. In the future, we can subscribe to
      // "connectionstatechange" events.
      localPeerConnection.close = function() {
        fetch(`${host}${prefix}/connections/${id}`, { method: 'delete' }).catch(() => {});
        return RTCPeerConnection.prototype.close.apply(this, arguments);
      };

      try {
        await localPeerConnection.setRemoteDescription(remotePeerConnection.localDescription);

        await beforeAnswer(localPeerConnection);

        const originalAnswer = await localPeerConnection.createAnswer();
        const updatedAnswer = new RTCSessionDescription({
          type: 'answer',
          sdp: stereo ? enableStereoOpus(originalAnswer.sdp) : originalAnswer.sdp
        });
        await localPeerConnection.setLocalDescription(updatedAnswer);

        console.log("remote-description");
        await fetch(`${host}${prefix}/connections/${id}/remote-description`, {
          method: 'POST',
          body: JSON.stringify(localPeerConnection.localDescription),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log("remote-description");

        return localPeerConnection;
      } catch (error) {
        console.log("error");
        localPeerConnection.close();
        throw error;
      }
    };
  }
}

function enableStereoOpus(sdp) {
  return sdp.replace(/a=fmtp:111/, 'a=fmtp:111 stereo=1\r\na=fmtp:111');
}

/**
 * The main interface to spaces, using a webRTC connection.
 *
 * - Maintains a webRTC connection to the space server
 * - Displays the desktop stream
 * - Captures user input for remote desktop control
 */
export default class WebRtcRoom extends Component {
  constructor(props) {
    super(props);
    this.state = { playState: "Stopped" };
    this.localVideoRef = React.createRef();
    this.remoteVideoRef = React.createRef();
  }

  componentDidMount() {
    // open webRTC connection
    if (this.props.spaceUrl) {
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
