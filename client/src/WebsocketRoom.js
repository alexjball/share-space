import React, { Component } from "react";
import "./Room.css";

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
  }

  async connect() {
    const response = await fetch(`${this.props.spaceUrl}/websocket/connect`),
      body = await response.json();

    if (response.ok) {
      return `Connected, offer: ${body.offer}`;
    }
    return `Failed to connect, ${response.status}`;
  }

  componentDidMount() {
    // open websocket connection
    if (this.props.spaceUrl) {
      this.connect()
        .then(status => this.setState({ status }))
        .catch(reason => this.setState({ status: String(reason) }));
    }
  }

  componentWillUnmount() {
    // close websocket connection
  }

  render() {
    return (
      <div className="room">
        <div>
          {`spaceUrl: ${this.props.spaceUrl} status: ${this.state.status}`}
        </div>
        <div className="video-container">
          <video
            muted={true}
            ref={this.videoRef}
            className="video"
          />
        </div>
      </div>
    );
  }
}
