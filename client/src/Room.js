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
    this.state = { status: "Waiting to connect" };
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
    }
  }

  componentWillUnmount() {
    // close webRTC connection
  }

  render() {
    return (
      <div className="room">{`spaceUrl: ${this.props.spaceUrl} status: ${this.state.status}`}</div>
    );
  }
}
