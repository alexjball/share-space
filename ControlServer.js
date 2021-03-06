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
        const goingAway = 1001;
        this.client.close(goingAway, "Breaking for new connection");
      }
      client.on("close", () => console.log("control connection closed"));
      client.on("error", err => console.log("control connection err", err));

      const clientStream = WebSocket.createWebSocketStream(client),
        vncStream = net.createConnection(this.vncPort, this.vncHost);
      clientStream.on("error", err => console.log("clientStream err", err));
      vncStream.on("error", err => console.log("vncStream err", err));
      clientStream.pipe(vncStream);
      vncStream.pipe(clientStream);

      console.log("control connection connected");
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
