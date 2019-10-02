const initWebRtc = require("./webrtc-server");
const initWebsocket = require("./websocket-server");
const express = require("express");

const app = express();

app.use(express.json());
app.set("port", process.env.PORT || 3001);

app.use("/assets", express.static("assets"));

const server = app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});

initWebRtc(app, "/rtc");
initWebsocket(server, "/websocket");