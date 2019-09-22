import React, { Component } from "react";
import "./ControlPanel.css";

/**
 * A floating control panel for user preferences and connection management.
 */
export default class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: !!props.initiallyOpen
    };
  }

  render() {
    const connect = this.props.connect || (() => {});
    return (
      <div className="control-container">
        <div
          className={`control-panel center ${this.state.open ? "" : "hidden"}`}
        >
          <input
            type="text"
            value={this.state.spaceUrl}
            onChange={e => this.setState({ spaceUrl: e.target.value })}
            style={{ marginRight: "10px" }}
          />
          <button onClick={() => connect(this.state.spaceUrl)}>connect</button>
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
