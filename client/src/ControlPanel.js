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
      spaceUrl: process.env.REACT_APP_DEFAULT_ROOM_SERVER || "localhost:3001"
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
            value={this.state.spaceUrl}
            onChange={e => this.setState({ spaceUrl: e.target.value })}
          />
          {/* <button
            className="item"
            onClick={() =>
              connect(
                this.state.spaceUrl,
                "WebRTC",
                this.clickId++
              )
            }
          >
            connect WebRTC
          </button> */}
          <button
            className="item"
            onClick={() =>
              connect(
                this.state.spaceUrl,
                "Websocket",
                this.clickId++
              )
            }
          >
            Connect
          </button>
        </div>
        <div className="center">
          <div
            className="control-handle"
            onClick={() => this.setState(state => ({ open: !state.open }))}
          />
        </div>
      </div>
    );
  }
}
