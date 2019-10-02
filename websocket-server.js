const WebSocket = require("ws");

module.exports = function init(server, prefix) {
  const wss = new WebSocket.Server({ server, path: prefix });

  wss.on("connection", ws => {
    ws.on("message", message => {
      console.log(`received ${message}`);
    });
    console.log("New connection");
    ws.send(Math.random());
  });
};
