const express = require("express");

const app = express();

app.set("port", process.env.PORT || 3001);

app.get("/stream", (req, res) => {
  const param = req.query.q;

  if (!param) {
    res.json({
      error: "Missing required parameter `q`"
    });
  } else {
    res.json({result: param})
  }
});

app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});
