import React, { Component } from "react";
import "./App.css";
import ControlPanel from "./ControlPanel.js";
import Room from "./Room.js";

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
    return (
      <div className="App">
        <ControlPanel initiallyOpen={true} connect={spaceUrl => this.setState({ spaceUrl })} />
        <Room spaceUrl={this.state.spaceUrl} key={this.state.spaceUrl} />
      </div>
    );
  }
}
