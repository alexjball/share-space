const initWebRtc = require("./webrtc-server");
const { StreamingMediaServer } = require("./StreamingMediaServer");
const express = require("express");

const baseDir = require("path").dirname(require.resolve("./package.json"));

const app = express();

app.use(express.json());
app.set("port", process.env.PORT || 3001);

app.use("/assets", express.static("assets"));

const server = app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});

// does request contain path? Does this affect paths other than the websocket ones?
server.on("upgrade", (request, socket, head) => {
  if (streamingMediaServer.shouldHandle(request)) {
    streamingMediaServer.handleUpgrade(request, socket, head);
  } else {
    console.log("Rejected upgrade request");
    socket.destroy();
  }
});

const streamingMediaServer = new StreamingMediaServer({
  streamingPath: "/stream",
  mediaSinkPath: `${baseDir}/build/server/share-space-media-sink.sock`,
  infoSinkPath: `${baseDir}/build/server/share-space-info-sink.sock`
});
streamingMediaServer.start();
initWebRtc(app, "/rtc");