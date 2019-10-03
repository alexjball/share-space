const WebSocket = require("ws");
const net = require("net");
const fs = require("fs");

class VideoServer {
  constructor({ streamingPath, sinkPath }) {
    this.streamingPath = streamingPath;
    this.sinkPath = sinkPath;
  }

  start() {
    if (this.wss || this.sink) {
      throw Error("Already started");
    }

    this.wss = new WebSocket.Server({
      noServer: true,
      path: this.streamingPath,
      clientTracking: true
    });

    this.wss.on("connection", ws => {
      console.log("new streaming connection");
      if (this.liveSocket) {
        this._connect(this.liveSocket, ws);
      }
      ws.on("close", () => console.log("closed streaming connection"));
    });

    this.sink = net.createServer(socket => {
      console.log("new sink connection");
      this.liveSocket = socket;
      socket.on("close", () => {
        console.log("closed sink connection");
        this.liveSocket = null;
      });
      // socket.on("data", data => console.log(`sink data ${data}`));
      this.wss.clients.forEach(ws => this._connect(socket, ws));
    });

    this.sink.on("error", err => console.log(`sink server error ${err}`));
    this.sink.on("close", err => console.log(`sink server close`));

    this.sink.maxConnections = 1;
    if (fs.existsSync(this.sinkPath)) {
      fs.unlinkSync(this.sinkPath);
    }
    this.sink.listen(this.sinkPath);
  }

  _connect(socket, ws) {
    // TODO: clean up websocket stream while keeping websocket open.
    socket.pipe(WebSocket.createWebSocketStream(ws), {end: false});
  }

  shouldHandle(req) {
    return this.wss.shouldHandle(req);
  }

  handleUpgrade(req, socket, head) {
    this.wss.handleUpgrade(req, socket, head, ws => {
      this.wss.emit("connection", ws, req);
    });
  }
}

module.exports = VideoServer;
