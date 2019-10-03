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
    const ws = (this.ws = new WebSocket(`ws://${this.props.spaceUrl}/stream`));

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
      event.data.text().then(msg => {
        this.setState({
          messageData: msg,
          lastMessageTime: performance.now()
        });
      });
    };
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
        <div>{`latest message data: ${this.state.messageData}`}</div>
        <div>{`latest message time: ${this.state.lastMessageTime}`}</div>
      </div>
    );
  }
}
