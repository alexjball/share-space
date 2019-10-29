const EventEmitter = require("events");
const net = require("net");

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
    proxy.on("connection", ws => {
      if (this.connection) {
        console.log("Existing control connection, killing it");
        this.connection.kill();
      }
      this.connection = new ControlConnection(ws, this.vncHost);
      this.connection.on("end", () => (this.connection = null));
    });
    proxy.on("close", () => console.log("ControlServer proxy closed"));

    return proxy;
  }

  shouldHandle(req) {
    return !this.connection && this.proxy.shouldHandle(req);
  }

  handleUpgrade(req, socket, head) {
    this.proxy.handleUpgrade(req, socket, head, connection => {
      this.proxy.emit("connection", connection, req);
    });
  }
};

class ControlConnection extends EventEmitter {
  constructor(client, vncPort, vncHost) {
    super();

    this.client = client;
    client.on("close", () => {
      this.emit("end");
    });

    this.vncHost = vncHost;
    this.vnc = net.createConnection(vncPort, vncHost);
  }
}
