import React, { Component } from "react";
import "./Room.css";
import RoomClient from "./RoomClient";
import ControlOverlay from "./ControlOverlay";
import StreamingMediaSourceVideo from "./StreamingMediaSourceVideo";

const disabled = -1;
let nextKey = 0;

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
    this.state = {
      status: "Authenticating",
      streamKey: nextKey++,
      controlKey: disabled
    };
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
      maxWidth: Number(process.env.REACT_APP_DESKTOP_WIDTH) || 1920,
      maxHeight: Number(process.env.REACT_APP_DESKTOP_HEIGHT) || 1080
    };
  }

  enableControl = () => {
    this.setState({ controlKey: nextKey++ });
  };

  disableControl = () => {
    this.setState({ controlKey: disabled });
  };

  disableStream = () => {
    this.setState({ streamKey: disabled });
  };

  enableStream = () => {
    this.setState({ streamKey: nextKey++ });
  };

  isControlEnabled = () => {
    return this.state.controlKey !== disabled;
  };

  isStreamEnabled = () => {
    return this.state.streamKey !== disabled;
  };

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
          <>
            <div className="room-controls">
              <button
                disabled={!this.isStreamEnabled()}
                onClick={this.disableStream}
              >
                Stop Video
              </button>
              <button onClick={this.enableStream}>
                {this.isStreamEnabled() ? "Reset Video" : "Start Video"}
              </button>
              <button
                disabled={this.isControlEnabled()}
                onClick={this.enableControl}
              >
                Grab Remote
              </button>
              <button
                disabled={!this.isControlEnabled()}
                onClick={this.disableControl}
              >
                Drop Remote
              </button>
            </div>
            <div style={this._getDesktopSize()} className="desktop">
              {this.isStreamEnabled() && (
                <StreamingMediaSourceVideo
                  key={this.state.streamKey}
                  roomClient={this.roomClient}
                  playbackState={info => this.setState(info)}
                />
              )}
              {this.isControlEnabled() && (
                <ControlOverlay
                  key={this.state.controlKey}
                  roomClient={this.roomClient}
                />
              )}
            </div>
          </>
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
