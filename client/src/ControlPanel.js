import React, { Component } from "react";
import "./ControlPanel.css";

/**
 * A floating control panel for user preferences and connection management.
 */
export default class ControlPanel extends Component {
  constructor(props) {
    super(props);

    this.state = {
      open: !!props.initiallyOpen,
      roomServer: process.env.REACT_APP_DEFAULT_ROOM_SERVER || "localhost:3001",
      roomCode: process.env.REACT_APP_DEFAULT_ROOM_CODE || "share-space"
    };
    this.clickId = 0;
  }

  render() {
    const connect = this.props.connect || (() => {});
    return (
      <div className="control-container">
        <div
          className={`control-panel center ${this.state.open ? "" : "hidden"}`}
        >
          <div className="item">Room server:</div>
          <input
            className="item"
            type="text"
            value={this.state.roomServer}
            onChange={e => this.setState({ roomServer: e.target.value })}
          />
          <div className="item">Room code:</div>
          <input
            className="item"
            type="password"
            value={this.state.roomCode}
            onChange={e => this.setState({ roomCode: e.target.value })}
          />
          <button
            className="item"
            onClick={() =>
              connect({
                roomServer: this.state.roomServer,
                roomCode: this.state.roomCode,
                key: this.clickId++
              })
            }
          >
            Connect
          </button>
          {process.env.REACT_APP_VNC_SERVER && (
            <button
              className="item"
              onClick={() => window.open(process.env.REACT_APP_VNC_SERVER)}
            >
              Open VNC
            </button>
          )}
        </div>
        {/* <div className="center">
          <div
            className="control-handle"
            onClick={() => this.setState(state => ({ open: !state.open }))}
          />
        </div> */}
      </div>
    );
  }
}
