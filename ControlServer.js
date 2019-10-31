const EventEmitter = require("events");
const net = require("net");
const WebSocket = require("ws");

/**
 * Handles control of the remote desktop by proxying a VNC connection.
 */
module.exports = class ControlServer {
  constructor(controlPath) {
    this.controlPath = controlPath;
    this.vncHost = process.env.CONTROL_SERVER_VNC_HOST || "localhost";
    this.vncPort = process.env.CONTROL_SERVER_VNC_PORT || "5900";
  }

  start() {
    this.proxy = this.createProxy();
  }

  createProxy() {
    const proxy = new WebSocket.Server({
      noServer: true,
      path: this.controlPath
    });
    proxy.on("connection", client => {
      if (this.client) {
        console.log("Existing control connection, closing it");
        this.client.close("Breaking for new connection");
      }
      client.on("close", () => console.log("control connection closed"));
      client.on("end", () => console.log("control connection ended"));
      client.on("error", error =>
        console.log("control connection errored", error)
      );
      WebSocket.createWebSocketStream(client).pipe(
        net.createConnection(this.vncPort, this.vncHost)
      );
      console.log("Connected");
      this.client = client;
    });
    proxy.on("close", () => console.log("ControlServer proxy closed"));

    return proxy;
  }

  shouldHandle(req) {
    return this.proxy.shouldHandle(req);
  }

  handleUpgrade(req, socket, head) {
    this.proxy.handleUpgrade(req, socket, head, connection => {
      this.proxy.emit("connection", connection, req);
    });
  }
};
