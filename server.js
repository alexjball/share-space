const { StreamingMediaServer } = require("./StreamingMediaServer");
const RoomCodeAuth = require("./RoomCodeAuth");
const express = require("express");
const http = require("http");
const baseDir = require("path").dirname(require.resolve("./package.json"));
var cors = require("cors");

const frontendPort = process.env.PORT || 3001,
  app = express(),
  frontend = http.createServer(app),
  auth = new RoomCodeAuth(),
  streamingMediaServer = new StreamingMediaServer({
    streamingPath: "/stream",
    mediaSinkPath: `${baseDir}/build/server/share-space-media-sink.sock`,
    infoSinkPath: `${baseDir}/build/server/share-space-info-sink.sock`
  });

//// HTTP

// Order of middleware matters.
app.use(auth.middleware());
app.use(express.json());

// No-auth middleware
app.use("/assets", express.static("assets"));

// Auth-required middleware
app.use("/", auth.requireAuth());
app.use("/", (req, res) => res.sendStatus(404));

//// WebSocket

frontend.on("upgrade", (request, socket, head) => {
  auth.checkAuth(request, (err, user) => {
    if (err) {
      console.log("error authenticating", err);
      socket.destroy();
      return;
    }
    
    console.log("upgrade authenticated", user);

    if (streamingMediaServer.shouldHandle(request)) {
      streamingMediaServer.handleUpgrade(request, socket, head);
    } else {
      console.log("Rejected upgrade request");
      socket.destroy();
    }
  })
});

//// Listen

streamingMediaServer.start();
frontend.listen(frontendPort, () => {
  console.log(`Find the server at: http://localhost:${frontendPort}/`); // eslint-disable-line no-console
});
