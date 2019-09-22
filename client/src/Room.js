import React, { Component } from "react";
import "./Room.css";

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
    this.state = { spaceUrl: props.spaceUrl };
  }

  render() {
    return <div className="room">{this.state.spaceUrl}</div>;
  }
}
