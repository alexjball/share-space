const initWebRtc = require("./webrtc-server");
const express = require("express");
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.set("port", process.env.PORT || 3001);

app.use("/assets", express.static("assets"));

app.get("/connect", (req, res) => {
  res.json({ offer: Math.random() });
});

app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});

initWebRtc(app, "/rtc");