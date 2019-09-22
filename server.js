const express = require("express");

const app = express();

app.set("port", process.env.PORT || 3001);

app.get("/connect", (req, res) => {
  res.json({offer: Math.random()});
});

app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});
