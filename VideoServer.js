const WebSocket = require("ws");
const net = require("net");
const fs = require("fs");

class VideoServer {
  constructor({ streamingPath, sinkPath }) {
    this.streamingPath = streamingPath;
    this.sinkPath = sinkPath;
    this.websocketStreams = new Map();
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
        this.startStreaming(ws);
      }
      ws.on("close", () => {
        console.log("closed streaming connection");
        const clientStream = this.websocketStreams.delete(ws);
        if (clientStream && this.liveSocket) {
          this.liveSocket.unpipe(clientStream);
        }
      });
    });

    this.sink = net.createServer(socket => {
      console.log("new sink connection");
      this.liveSocket = socket;
      socket.on("close", () => {
        console.log("closed sink connection");
        this.liveSocket = null;
      });
      // socket.on("data", data => console.log(`sink data ${data}`));
      this.wss.clients.forEach(ws => this.startStreaming(ws));
    });

    this.sink.on("error", err => console.log(`sink server error ${err}`));
    this.sink.on("close", err => console.log(`sink server close`));

    this.sink.maxConnections = 1;
    if (fs.existsSync(this.sinkPath)) {
      fs.unlinkSync(this.sinkPath);
    }
    this.sink.listen(this.sinkPath);
  }

  startStreaming(ws) {
    if (!this.liveSocket) {
      throw Error("No stream available");
    }
    if (!this.websocketStreams.has(ws)) {
      const clientStream = WebSocket.createWebSocketStream(ws);
      clientStream.on("error", err =>
        console.error(`Error in client stream: ${err}`)
      );
      this.websocketStreams.set(ws, clientStream);
    }
    this.liveSocket.pipe(
      this.websocketStreams.get(ws),
      { end: false }
    );
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
