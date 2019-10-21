const {
  StreamingMediaServer,
  MediaSink,
  MediaParser,
  MediaConsumer,
  MediaMultiplexer,
  InitSegmentParser
} = require("./StreamingMediaServer");

it("does nothing", () => {
  const server = new StreamingMediaServer({
    streamingPath: "streamingPath",
    mediaSinkPath: "mediaSinkPath",
    infoSinkPath: "infoSinkPath"
  });
});

it("parses segments", () => {
  const parser = new MediaParser();
})