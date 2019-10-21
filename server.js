const initWebRtc = require("./webrtc-server");
const { StreamingMediaServer } = require("./StreamingMediaServer");
const express = require("express");

const app = express();

app.use(express.json());
app.set("port", process.env.PORT || 3001);

app.use("/assets", express.static("assets"));

const server = app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});

server.on("upgrade", (request, socket, head) => {
  if (streamingMediaServer.shouldHandle(request)) {
    streamingMediaServer.handleUpgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

const streamingMediaServer = new StreamingMediaServer({
  streamingPath: "/stream",
  mediaSinkPath: "/tmp/share-space-video-sink.sock",
  infoSinkPath: "/tmp/share-space-info-sink.sock"
});
streamingMediaServer.start();
initWebRtc(app, "/rtc");
