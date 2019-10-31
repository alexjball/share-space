import React, { Component } from "react";
import "./App.css";
import ControlPanel from "./ControlPanel.js";
import WebsocketRoom from "./WebsocketRoom.js";

/**
 * Full-screen root component of the app.
 *
 * The control panel shows information about the user session and provides
 * UI for connecting and disconnecting to spaces.
 *
 * The room displays the desktop stream and captures mouse and keyboard input. It also
 * displays behavior served by the space, such as requesting control and chat.
 */
export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    let room;
    if (this.state.key !== undefined) {
      room = (
        <WebsocketRoom
          roomServer={this.state.roomServer}
          roomCode={this.state.roomCode}
          key={this.state.key}
        />
      );
    } else {
      room = <div className="room" />;
    }

    return (
      <div className="App">
        <ControlPanel
          initiallyOpen={true}
          connect={({ roomServer, roomCode, key }) =>
            this.setState({ roomServer, roomCode, key })
          }
        />
        {room}
      </div>
    );
  }
}
