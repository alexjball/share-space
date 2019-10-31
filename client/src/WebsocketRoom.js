import React, { Component } from "react";
import "./Room.css";
import RoomClient from "./RoomClient";
import ControlOverlay from "./ControlOverlay";
import StreamingMediaSourceVideo from "./StreamingMediaSourceVideo";

/**
 * The main interface to spaces, using a websocket.
 *
 * - Maintains a websocket connection to the room server.
 * - Displays the desktop stream
 * - Captures user input for remote desktop control
 */
export default class WebsocketRoom extends Component {
  constructor(props) {
    super(props);
    this.state = { status: "Authenticating" };
    this.roomClient = new RoomClient(
      this.props.roomServer,
      window.location.protocol.startsWith("https") ? "https" : "http"
    );
  }

  componentDidMount() {
    this.roomClient
      .logIn(this.props.roomCode)
      .then(() => this.setState({ authenticated: true }))
      .catch(() =>
        this.setState({ status: "Couldn't authenticate, check code" })
      );
  }

  _getDesktopSize() {
    return {
      width: Number(process.env.REACT_APP_DESKTOP_WIDTH) || 1280,
      height: Number(process.env.REACT_APP_DESKTOP_HEIGHT) || 720
    };
  }

  render() {
    return (
      <div className="room">
        <div>{`Room server: ${this.props.roomServer}`}</div>
        <div>{`status: ${this.state.status}`}</div>
        <div>{`latest message time: ${Number(
          1e-3 * this.state.lastMessageTime
        ).toFixed(3)} s`}</div>
        <div>{`average stream bitrate: ${Number(
          this.state.averageBitrate
        ).toFixed(1)} kb/s`}</div>
        <Clock />
        {this.state.authenticated && (
          <div
            style={this._getDesktopSize()}
            className="desktop"
          >
            <StreamingMediaSourceVideo
              roomClient={this.roomClient}
              playbackState={info => this.setState(info)}
            />
            <ControlOverlay roomClient={this.roomClient} />
          </div>
        )}
      </div>
    );
  }
}

class Clock extends Component {
  constructor(props) {
    super(props);
    this.state = {
      now: new Date()
    };
  }

  componentDidMount() {
    this.updateTime();
  }

  updateTime = () => {
    this.setState({ now: new Date() });
    this.tid = setTimeout(this.updateTime, 500);
  };

  componentWillUnmount() {
    if (this.tid) {
      clearTimeout(this.tid);
    }
  }

  timeDigit(x) {
    const s = String(x);
    return s.length === 1 ? `0${s}` : s;
  }

  render() {
    const now = this.state.now,
      theTime = `${this.timeDigit(now.getHours())}:${this.timeDigit(
        now.getMinutes()
      )}:${this.timeDigit(now.getSeconds())}`;
    return <div>Current time: {theTime}</div>;
  }
}
