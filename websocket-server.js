module.exports = function init(app, prefix) {
  app.get(`${prefix}/connect`, (req, res) => {
    res.json({ offer: Math.random() });
  });
};
