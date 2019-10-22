const {
  StreamingMediaServer,
  MediaParser,
  MediaMultiplexer,
  InitSegmentParser,
  INIT_SEGMENT,
  MEDIA_SEGMENT
} = require("./StreamingMediaServer");
const fs = require("fs");
const os = require("os");
const { sep } = require("path");
const http = require("http");
const WebSocket = require("ws");
const net = require("net");

const testInfo = fs.readFileSync("assets/test-media-stream.info", {
    encoding: "utf8"
  }),
  testInfos = testInfo
    .split("\n")
    .filter(s => s.length)
    .map(s => JSON.parse(s)),
  testMedia = fs.readFileSync("assets/test-media-stream.webm"),
  testSegments = testInfos.map((info, i) =>
    testMedia.slice(
      info.offset,
      i < testInfos.length - 1 ? testInfos[i + 1].offset : testMedia.length
    )
  ),
  streamingPath = "/stream",
  tmpDir = fs.mkdtempSync(`${os.tmpdir()}${sep}`),
  mediaSinkPath = `${tmpDir}${sep}media-sink.sock`,
  infoSinkPath = `${tmpDir}${sep}info-sink.sock`,
  frontendHost = "localhost";

describe("StreamingMediaServer", () => {
  let mediaServer, frontend, clientUrlPrefix;

  beforeEach(done => {
    frontend = http.createServer();
    frontend.on("upgrade", (request, socket, head) => {
      if (mediaServer.shouldHandle(request)) {
        mediaServer.handleUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    });
    frontend.listen(0, frontendHost, () => {
      clientUrlPrefix = `http://${frontendHost}:${
        frontend.address().port
      }`;
      done();
    });

    mediaServer = new StreamingMediaServer({
      streamingPath,
      mediaSinkPath,
      infoSinkPath
    });
  });

  afterEach(() => {
    [mediaSinkPath, infoSinkPath].forEach(path => {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    });

    return Promise.all([
      new Promise(resolve => frontend.close(() => resolve())),
      new Promise(resolve => mediaServer.close(() => resolve()))
    ]);
  });

  afterAll(done => {
    // Give a small timeout to allow sockets to close. This prevents Jest
    // from complaining about logging after tests complete.
    setTimeout(() => done(), 100);
  });

  it("starts", () => {
    mediaServer.start();
  });

  it("connects on streamingPath", done => {
    mediaServer.start();

    const client = new WebSocket(`${clientUrlPrefix}${streamingPath}`);
    client.on("open", () => done());
  });

  it("connects on mediaSinkPath", done => {
    mediaServer.start();

    net.createConnection(mediaSinkPath, () => done());
  });

  it("connects on infoSinkPath", done => {
    mediaServer.start();

    net.createConnection(infoSinkPath, () => done());
  });

  it("serves full stream when client connects before stream starts", done => {
    mediaServer.start();

    const mediaSink = net.createConnection(mediaSinkPath);
    const infoSink = net.createConnection(infoSinkPath);
    const client = new WebSocket(`${clientUrlPrefix}${streamingPath}`),
      chunks = [];
    let totalSize = 0;
    client.on("message", data => {
      chunks.push(data);
      totalSize += data.length;
      expect(totalSize).toBeLessThanOrEqual(testMedia.length);
      if (totalSize === testMedia.length) {
        expect(Buffer.concat(chunks)).toEqual(testMedia);
        done();
      }
    });

    const open = {}, writeAfterAllConnect = type => {
      open[type] = true;
      if (open.media && open.info && open.client) {
        mediaSink.write(testMedia);
        infoSink.write(testInfo);
      }
    }
    mediaSink.once("connect", () => writeAfterAllConnect("media"));
    infoSink.once("connect", () => writeAfterAllConnect("info"));
    client.once("open", () => writeAfterAllConnect("client"));
  });
});

describe("MediaMultiplexer", () => {
  let mediaParser, initSegmentParser, multiplexer;

  beforeEach(() => {
    mediaParser = new MediaParser();
    initSegmentParser = new InitSegmentParser(mediaParser);
    multiplexer = new MediaMultiplexer(mediaParser, initSegmentParser);
  });

  it("works if consumers are added before the stream starts", () => {
    const chunks = [],
      onData = data => chunks.push(data);
    multiplexer.addConsumer(onData);

    testInfos.forEach(info => mediaParser.addInfo(info));
    testSegments.forEach(segment => mediaParser.addMedia(segment));

    expect(Buffer.concat(chunks)).toEqual(testMedia);
  });

  it("works if consumers are added during the initialization segment", () => {
    const initSegment = testSegments[0],
      mediaSegments = testSegments.slice(1),
      splitIndex = 30,
      chunk1 = initSegment.subarray(0, splitIndex),
      chunk2 = initSegment.subarray(splitIndex);

    const chunks = [],
      onData = data => chunks.push(data);

    testInfos.forEach(info => mediaParser.addInfo(info));

    mediaParser.addMedia(chunk1);
    expect(initSegmentParser.initSegment).toBeFalsy();
    expect(initSegmentParser.started).toBeTruthy();

    multiplexer.addConsumer(onData);

    mediaParser.addMedia(chunk2);
    mediaSegments.forEach(segment => mediaParser.addMedia(segment));

    // Consumers added during initialization do not receive the first media segment
    expect(Buffer.concat(chunks)).toEqual(
      Buffer.concat([initSegment, ...testSegments.slice(2)])
    );
  });

  it("works if consumers are added after the initialization segment", () => {
    const initSegment = testSegments[0],
      mediaSegments = testSegments.slice(1);

    const chunks = [],
      onData = data => chunks.push(data);

    testInfos.forEach(info => mediaParser.addInfo(info));

    mediaParser.addMedia(initSegment);
    mediaParser.addMedia(mediaSegments[0]);

    expect(initSegmentParser.initSegment).toBeTruthy();

    multiplexer.addConsumer(onData);

    mediaSegments.slice(1).forEach(segment => mediaParser.addMedia(segment));

    expect(Buffer.concat(chunks)).toEqual(
      Buffer.concat([initSegment, ...mediaSegments.slice(1)])
    );
  });

  it("works with multiple consumers", () => {
    const chunks1 = [],
      onData1 = data => chunks1.push(data);
    multiplexer.addConsumer(onData1);
    const chunks2 = [],
      onData2 = data => chunks2.push(data);
    multiplexer.addConsumer(onData2);

    testInfos.forEach(info => mediaParser.addInfo(info));
    testSegments.forEach(segment => mediaParser.addMedia(segment));

    expect(Buffer.concat(chunks1)).toEqual(testMedia);
    expect(Buffer.concat(chunks2)).toEqual(testMedia);
  });

  it("does not call consumers after removal", () => {
    const chunks = [],
      onData = data => chunks.push(data);
    multiplexer.addConsumer(onData);

    testInfos.forEach(info => mediaParser.addInfo(info));

    const expectedSegments = testSegments.slice(0, 2);

    expectedSegments.forEach(segment => mediaParser.addMedia(segment));
    multiplexer.removeConsumer(onData);
    testSegments.slice(2).forEach(segment => mediaParser.addMedia(segment));

    expect(Buffer.concat(chunks)).toEqual(Buffer.concat(expectedSegments));
  });
});

describe("InitSegmentParser", () => {
  let parser, dataEvents, newSegmentEvents;

  beforeEach(() => {
    parser = new MediaParser();
    dataEvents = [];
    newSegmentEvents = [];
    parser.on("data", data => dataEvents.push(data));
    parser.on("newSegment", newSegment => newSegmentEvents.push(newSegment));
  });

  it("extracts init segment", () => {
    const expectedInitSegment = testSegments[0];

    let initSegmentEvent;
    const initSegmentParser = new InitSegmentParser(parser);
    initSegmentParser.on("initSegment", event => (initSegmentEvent = event));

    expect(initSegmentEvent).toBeFalsy();
    expect(initSegmentParser.initSegment).toBeFalsy();
    expect(initSegmentParser.started).toBeFalsy();

    const split1 = 10,
      chunk1 = expectedInitSegment.subarray(0, split1),
      split2 = 30,
      chunk2 = expectedInitSegment.subarray(split1, split2),
      chunk3 = Buffer.concat([
        expectedInitSegment.subarray(split2),
        testSegments[1]
      ]);

    parser.addInfo(testInfos[0]);
    parser.addMedia(chunk1);
    expect(initSegmentParser.started).toBeTruthy();
    expect(initSegmentEvent).toBeFalsy();
    expect(initSegmentParser.initSegment).toBeFalsy();

    parser.addMedia(chunk2);
    expect(initSegmentParser.started).toBeTruthy();
    expect(initSegmentEvent).toBeFalsy();
    expect(initSegmentParser.initSegment).toBeFalsy();

    parser.addInfo(testInfos[1]);
    expect(initSegmentParser.started).toBeTruthy();
    expect(initSegmentEvent).toBeFalsy();
    expect(initSegmentParser.initSegment).toBeFalsy();

    parser.addMedia(chunk3);
    expect(initSegmentParser.started).toBeTruthy();
    expect(initSegmentEvent).toEqual(expectedInitSegment);
    expect(initSegmentParser.initSegment).toEqual(expectedInitSegment);
  });
});

describe("MediaParser", () => {
  let parser, dataEvents, newSegmentEvents;

  beforeEach(() => {
    parser = new MediaParser();
    dataEvents = [];
    newSegmentEvents = [];
    parser.on("data", data => dataEvents.push(data));
    parser.on("newSegment", newSegment => newSegmentEvents.push(newSegment));
  });

  it("emits data", () => {
    let i;
    for (i = 0; i < testSegments.length; i++) {
      parser.addMedia(testSegments[i]);

      expect(dataEvents).toHaveLength(i + 1);
      expect(dataEvents[i]).toMatchObject({
        start: testInfos[i].offset,
        buffer: testSegments[i]
      });
    }
  });

  it("emits newSegment for aligned video following info", () => {
    testInfos.forEach(info => parser.addInfo(info));
    testSegments.forEach((segment, i) => {
      parser.addMedia(segment);
      const newSegment = newSegmentEvents.shift();
      expect(newSegmentEvents).toHaveLength(0);
      expect(newSegment).toEqual({
        type: i === 0 ? INIT_SEGMENT : MEDIA_SEGMENT,
        start: testInfos[i].offset,
        buffers: [segment]
      });
    });
  });

  it("emits multiple new segments for video following info", () => {
    testInfos.forEach(info => parser.addInfo(info));
    const dummyChunk = Buffer.alloc(25, 10);
    const bigChunk = Buffer.concat([
      testSegments[0],
      testSegments[1],
      dummyChunk
    ]);
    parser.addMedia(bigChunk);
    expect(newSegmentEvents).toHaveLength(3);
    expect(newSegmentEvents).toEqual([
      { type: INIT_SEGMENT, start: testInfos[0].offset, buffers: [bigChunk] },
      {
        type: MEDIA_SEGMENT,
        start: testInfos[1].offset,
        buffers: [bigChunk.subarray(testInfos[1].offset)]
      },
      { type: MEDIA_SEGMENT, start: testInfos[2].offset, buffers: [dummyChunk] }
    ]);
  });

  it("does not emit newSegment if no boundary intersection", () => {
    testInfos.forEach(info => parser.addInfo(info));
    const splitIndex = 10,
      segmentStart = testSegments[0].subarray(0, splitIndex),
      segmentEnd = testSegments[0].subarray(splitIndex);

    parser.addMedia(segmentStart);
    expect(newSegmentEvents).toHaveLength(1);

    parser.addMedia(segmentEnd);
    expect(newSegmentEvents).toHaveLength(1);
  });

  it("emits newSegment for info following video", () => {
    testSegments.forEach(segment => parser.addMedia(segment));

    let segmentEvent;

    parser.addInfo(testInfos[0]);
    segmentEvent = newSegmentEvents.shift();
    expect(newSegmentEvents).toHaveLength(0);
    expect(segmentEvent).toEqual({
      type: INIT_SEGMENT,
      start: 0,
      buffers: testSegments
    });

    parser.addInfo(testInfos[1]);
    segmentEvent = newSegmentEvents.shift();
    expect(newSegmentEvents).toHaveLength(0);
    expect(segmentEvent).toEqual({
      type: MEDIA_SEGMENT,
      start: testInfos[1].offset,
      buffers: testSegments.slice(1)
    });
  });
});
