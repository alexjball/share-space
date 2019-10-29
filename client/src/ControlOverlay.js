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
    this.rfb.showDotCursor = true;
    this.rfbCreated(this.rfb);
  }

  componentWillUnmount() {
    this.rfbDestroyed(this.rfb);
    this.rfb.disconnect();
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

  rfbCreated = rfb => {
    rfb.addEventListener("connect", () => this.setState({ connected: true }));
    rfb.addEventListener("disconnect", () =>
      this.setState({ connected: false })
    );
    rfb.addEventListener("credentialsrequired", e =>
      console.error("credentialsrequired", e)
    );
    rfb.addEventListener("desktopname", e => console.log("desktopname", e));
  };

  rfbDestroyed = rfb => {};
}
