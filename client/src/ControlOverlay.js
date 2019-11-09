import React, { Component } from "react";
import "./Room.css";
import RFB from "@novnc/novnc/core/rfb";

export default class ControlOverlay extends Component {
  constructor(props) {
    super(props);
    this.rfbTarget = React.createRef();
    this.state = {};
  }

  componentDidMount() {
    this.rfb = new RFB(
      this.rfbTarget.current,
      this.props.roomClient.getControlUrl()
    );
    this.rfb.scaleViewport = true;
    this.rfb.showDotCursor = true;
    this.rfbListeners = {
      connect: () => this.setState({ connected: true }),
      disconnect: () => this.setState({ connected: false }),
      credentialsrequired: e => console.error("credentialsrequired", e),
      desktopname: e => console.log("desktopname", e)
    };
    let event;
    for (event in this.rfbListeners) {
      this.rfb.addEventListener(event, this.rfbListeners[event]);
    }
  }

  componentWillUnmount() {
    this.rfb.disconnect();
    let event;
    for (event in this.rfbListeners) {
      this.rfb.removeEventListener(event, this.rfbListeners[event]);
    }
  }

  render() {
    const visibility = this.props.visible ? "visible" : "invisible";
    const connected = this.state.connected ? "connected" : "";
    return (
      <div className={`control-overlay-container ${connected}`}>
        <div className={`control-overlay ${visibility}`} ref={this.rfbTarget} />
      </div>
    );
  }
}
