const WebSocket = require("ws");
const net = require("net");
const fs = require("fs");
const EventEmitter = require("events");
const _ = require("lodash");

/** Handles connections to the media sink */
class StreamingMediaServer extends EventEmitter {
  constructor({ streamingPath, mediaSinkPath, infoSinkPath }) {
    super();
    this.paths = {
      stream: streamingPath,
      media: mediaSinkPath,
      info: infoSinkPath
    };
    this.clients = new Map();
    this.clientServer = null;
    this.mediaServer = null;
    this.infoServer = null;
    this.sinkConnection = {};
    this.closed = {};
  }

  start() {
    if (this.mediaServer) {
      throw Error("Already started");
    }

    this.clientServer = this.createClientServer();
    this.mediaServer = this.createMediaServer();
    this.infoServer = this.createInfoServer();

    [this.paths.media, this.paths.info].forEach(path => {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    });
    this.mediaServer.listen({ path: this.paths.media });
    this.infoServer.listen({ path: this.paths.info });
  }

  createClientServer() {
    const clientServer = new WebSocket.Server({
      noServer: true,
      path: this.paths.stream
    });
    clientServer.on("connection", ws => {
      console.log("new streaming connection");
      this.addClient(ws);
      ws.on("close", () => {
        console.log("closed streaming connection");
        this.removeClient(ws);
      });
    });
    clientServer.on("close", () => this.closeServer("client"));

    return clientServer;
  }

  createMediaServer() {
    const mediaServer = net.createServer(socket => {
      console.log("new media sink connection");
      this.openSinkConnection({ media: socket });
      socket.on("close", hadError => {
        console.log(`closed media sink connection, hadError: ${hadError}`);
        this.closeSinkConnection();
      });
      socket.on("data", data => this.sinkConnection.sink.addMedia(data));
      socket.on("error", err => console.log(`media sink error ${err}`));
    });
    mediaServer.on("error", err =>
      console.log(`media sink server error ${err}`)
    );
    mediaServer.on("close", () => this.closeServer("media"));
    mediaServer.maxConnections = 1;

    return mediaServer;
  }

  createInfoServer() {
    const infoServer = net.createServer(socket => {
      console.log("new info sink connection");
      socket.setEncoding("utf8");
      this.openSinkConnection({ info: socket });
      socket.on("close", hadError => {
        console.log(`closed info sink connection, hadError: ${hadError}`);
        this.closeSinkConnection();
      });
      socket.on("data", data => this.sinkConnection.sink.addInfo(data));
      socket.on("error", err =>
        console.log(`info sink connection error ${err}`)
      );
    });
    infoServer.on("error", err => console.log(`info sink server error ${err}`));
    infoServer.on("close", () => this.closeServer("info"));
    infoServer.maxConnections = 1;

    return infoServer;
  }

  closeServer(type) {
    console.log(`closed ${type} server`);
    this.closed[type] = true;

    if (
      !this.closed.all &&
      this.closed.media &&
      this.closed.info &&
      this.closed.client
    ) {
      this.closed.all = true;
      this.emit("close");
    }
  }

  /**
   * Close the media server, closing contained servers and ending open connections.
   *
   * The `close` event is emitted after all servers have closed and connections
   * have ended (but not necessarily closed)
   */
  close(callback) {
    if (!this.mediaServer) {
      throw Error("Not started");
    } else if (this.closed.all) {
      return;
    }

    if (callback) {
      this.once("close", callback);
    }

    this.closeSinkConnection();
    this.mediaServer.close();
    this.infoServer.close();
    this.clientServer.close();
  }

  openSinkConnection(sockets = {}) {
    this.sinkConnection.sink = this.sinkConnection.sink || new MediaSink();
    Object.assign(this.sinkConnection, sockets);
    return this.sinkConnection;
  }

  closeSinkConnection() {
    if (this.sinkConnection.info) {
      this.sinkConnection.info.end();
    }
    if (this.sinkConnection.media) {
      this.sinkConnection.media.end();
    }
    if (this.sinkConnection.sink) {
      Array.from(this.clients.keys()).forEach(client => {
        this.removeClient(client);
        client.close();
      });
    }
    this.sinkConnection = {};
  }

  addClient(ws) {
    const onData = data => ws.send(data);
    this.clients.set(ws, onData);
    this.openSinkConnection().sink.addConsumer(onData);
  }

  removeClient(ws) {
    if (this.clients.has(ws) && this.sinkConnection.sink) {
      this.sinkConnection.sink.removeConsumer(this.clients.get(ws));
      this.clients.delete(ws);
    }
  }

  shouldHandle(req) {
    return this.clientServer.shouldHandle(req);
  }

  handleUpgrade(req, socket, head) {
    this.clientServer.handleUpgrade(req, socket, head, ws => {
      this.clientServer.emit("connection", ws, req);
    });
  }
}

const INIT_SEGMENT = (INIT_SEGMENT_START = 1);
const MEDIA_SEGMENT = (MEDIA_SEGMENT_START = 2);

/**
 * Top-level interface for sharing a media stream across consumers.
 */
class MediaSink {
  constructor() {
    this.mediaParser = new MediaParser();
    this.initSegmentParser = new InitSegmentParser(this.mediaParser);
    this.mediaMultiplexer = new MediaMultiplexer(
      this.mediaParser,
      this.initSegmentParser
    );
    this.partialInfo = "";
  }

  /**
   * Consumes a chunk of the media stream contained in `buffer`.
   *
   * The buffers passed to this method in order should form the complete stream.
   */
  addMedia(buffer) {
    this.mediaParser.addMedia(buffer);
  }

  /**
   * Consumes information about the stream.
   *
   * This information is used to split the stream into segments and then reconstruct valid
   * streams to pass to consumers.
   *
   * `info` is a string that forms a stream of newline-delimited JSON of the form
   * `{event: INIT_SEGMENT_START|MEDIA_SEGMENT_START, offset: Integer}`.
   */
  addInfo(info) {
    const infos = (this.partialInfo + info).split("\n").filter(s => s.length);
    infos.forEach((info, i) => {
      try {
        const { event, offset } = JSON.parse(info);
        this.mediaParser.addInfo({ event, offset });
      } catch (e) {
        if (e instanceof SyntaxError && i === infos.length - 1) {
          // The trailing string couldn't be parsed, presumably because network packets aren't
          // aligned with info boundaries.
          this.partialInfo = info;
        } else {
          throw e;
        }
      }
    });
  }

  /**
   * Add a new consumer to start receiving media.
   *
   * The consumer is fed the initialization segment, then media segments. As the sink ingests
   * media and info, it matches the events in info to the data available in media. Consumers
   * will receive a continuous stream of media segments starting with the first one that is
   * matched after the consumer is added.
   *
   * The sink does not modify timing of frames within segments, so the stream may start at a
   * non-zero time. Clients can detect this based on the available buffered time ranges.
   *
   * @param dataCallback a function that accepts buffers which form a valid media stream.
   *                     The buffers should not be modified.
   */
  addConsumer(dataCallback) {
    this.mediaMultiplexer.addConsumer(dataCallback);
  }

  /**
   * Stops sending data to the given consumer, if it was previously added with `addConsumer`
   */
  removeConsumer(dataCallback) {
    this.mediaMultiplexer.removeConsumer(dataCallback);
  }
}

/**
 * Breaks a media stream into segments.
 *
 * emits a `data` event with `{start: Integer, buffer: Buffer}` when a new media buffer
 * is received. `start` is the offset of the first byte in the buffer relative to the
 * start of the stream. The buffer should not be modified.
 *
 * emits a `segmentStart` event with
 * `{type: INIT_SEGMENT|MEDIA_SEGMENT, start: Integer, buffers: [Buffer]}` when a new
 * segment is detected. `buffers` contains all data from the start of the segment through
 * the last `data` event emitted.
 *
 * `data` events always precede `segmentStart` events. This means that listening once
 * for `segmentStart` then on `data` results in a seemless media stream beginning at
 * the received segment.
 */
class MediaParser extends EventEmitter {
  constructor() {
    super();

    this.started = false;

    this.info = {
      // Offset of the start of the latest segment received in the info stream, or 0.
      end: 0,
      // Holds stream info when info leads media.
      buffered: []
    };

    this.media = {
      // Offset of the end of the latest media buffer received in the media stream, or 0.
      end: 0,
      // Holds stream media when media leads info
      buffered: []
    };
  }

  addMedia(buffer) {
    this.started = true;

    const mediaStart = this.media.end,
      mediaEnd = mediaStart + buffer.length,
      mediaData = { start: mediaStart, buffer };

    const [newSegmentBoundaries, futureSegmentBoundaries] = _.partition(
      this.info.buffered,
      info => mediaStart <= info.offset && mediaEnd > info.offset
    );

    this.emit("data", mediaData);

    newSegmentBoundaries.forEach(boundary => {
      this.emit("newSegment", {
        type:
          boundary.event === INIT_SEGMENT_START ? INIT_SEGMENT : MEDIA_SEGMENT,
        start: boundary.offset,
        buffers: [buffer.subarray(boundary.offset - mediaStart)]
      });
    });

    // Buffer media if it now leads info
    if (mediaEnd > this.info.end) {
      this.media.buffered.push(mediaData);
    }
    this.media.end = mediaEnd;
    this.info.buffered = futureSegmentBoundaries;
  }

  addInfo({ event, offset }) {
    this.started = true;

    if (event !== INIT_SEGMENT_START && event !== MEDIA_SEGMENT_START) {
      throw Error(`Invalid event ${event}`);
    } else if (this.initSegmentReceived && event === INIT_SEGMENT_START) {
      throw Error(`Expected media segment start, got init at offset ${offset}`);
    } else if (!this.initSegmentReceived && event === MEDIA_SEGMENT_START) {
      throw Error(`Expected init segment start, got media at offset ${offset}`);
    } else if (offset < this.info.end) {
      throw Error(`Expected info offset >= ${this.info.end}, got ${offset}`);
    }

    this.info.end = offset;

    if (event === INIT_SEGMENT_START) {
      this.initSegmentReceived = true;
    }

    if (offset < this.media.end) {
      // newSegmentData is nonempty since media is buffered whenever media.end > offset.
      // Find all segments that start after or contain offset
      const [newSegmentData, unused] = _.partition(
        this.media.buffered,
        data => data.start >= offset || data.start + data.buffer.length > offset
      );
      this.emit("newSegment", {
        type: event === INIT_SEGMENT_START ? INIT_SEGMENT : MEDIA_SEGMENT,
        start: newSegmentData[0].start,
        buffers: newSegmentData.map(({ start, buffer }) =>
          offset > start ? buffer.subarray(offset - start) : buffer
        )
      });
      this.media.buffered = newSegmentData;
    } else {
      // Info leads media
      this.info.buffered.push({ event, offset });
    }
  }
}

/** Extracts and stores the initialization segment from a parsed media stream. */
class InitSegmentParser extends EventEmitter {
  constructor(mediaParser) {
    if (mediaParser.started) {
      throw Error("mediaParser is already started, must not be");
    }

    super();

    this.started = false;
    this.mediaParser = mediaParser;
    this.initBuffers = [];
    this.initStart = null;
    this.initEnd = null;

    this.mediaParser.on("newSegment", this.onNewSegment);
  }

  onNewSegment = ({ type, start, buffers }) => {
    this.started = true;

    if (type === INIT_SEGMENT) {
      this.initStart = start;
      this.initBuffers.push(...buffers);
      this.mediaParser.on("data", this.onData);
    } else {
      this.initEnd = start;
      this.mediaParser.off("data", this.onData);
      this.mediaParser.off("newSegment", this.onNewSegment);
      this.buildInitSegment();
    }
  };

  onData = ({ buffer }) => {
    this.initBuffers.push(buffer);
  };

  buildInitSegment() {
    const initSegmentSize = this.initEnd - this.initStart,
      initSegment = Buffer.alloc(initSegmentSize);
    let i,
      buffer,
      copySize,
      offset = 0;
    for (i = 0; i < this.initBuffers.length; i++) {
      buffer = this.initBuffers[i];
      copySize = Math.min(initSegmentSize - offset, buffer.length);
      buffer.copy(initSegment, offset, 0, copySize);
      offset += copySize;
      if (offset == this.initEnd) {
        break;
      }
    }

    this.initSegment = initSegment;
    this.emit("initSegment", initSegment);
  }
}

/** Forwards a media stream to a single data callback. */
class MediaConsumer {
  constructor(mediaParser, onData) {
    this.mediaParser = mediaParser;
    this.onData = onData;
  }

  start(initSegment) {
    if (initSegment) {
      this.onData(initSegment);
    }
    this.mediaParser.once("newSegment", this.onNewSegment);
  }

  onNewSegment = ({ buffers }) => {
    buffers.forEach(buffer => this.onData(buffer));
    this.dataListener = ({ buffer }) => this.onData(buffer);
    this.mediaParser.on("data", this.dataListener);
  };

  unregister() {
    this.mediaParser.off("newSegment", this.onNewSegment);
    if (this.dataListener) {
      this.mediaParser.off("data", this.dataListener);
    }
  }
}

/** Splits a parsed media stream between attached consumers. */
class MediaMultiplexer {
  constructor(mediaParser, initSegmentParser) {
    if (mediaParser.started) {
      throw Error("mediaParser is already started, must not be");
    }

    this.consumers = new Map();
    this.mediaParser = mediaParser;
    this.initSegmentParser = initSegmentParser;
    this.delayedConsumers = [];

    if (initSegmentParser.initSegment) {
      this.initSegment = this.initSegment;
    } else {
      initSegmentParser.once("initSegment", initSegment => {
        this.initSegment = initSegment;
        this.delayedConsumers.forEach(consumer => consumer.start(initSegment));
        this.delayedConsumers = null;
      });
    }
  }

  /**
   * Add a data callback to receive a media stream.
   *
   * `dataCallback` is a function that accepts a Buffer of media bytes.
   */
  addConsumer(dataCallback) {
    if (this.consumers.has(dataCallback)) {
      throw Error("Consumer already added");
    }

    const consumer = new MediaConsumer(this.mediaParser, dataCallback);
    this.consumers.set(dataCallback, consumer);

    if (this.initSegment) {
      consumer.start(this.initSegment);
    } else if (this.initSegmentParser.started) {
      this.delayedConsumers.push(consumer);
    } else {
      consumer.start();
    }
  }

  removeConsumer(dataCallback) {
    if (this.consumers.has(dataCallback)) {
      this.consumers.get(dataCallback).unregister();
      this.consumers.delete(dataCallback);
    }
  }
}

module.exports = {
  StreamingMediaServer,
  MediaSink,
  MediaParser,
  MediaConsumer,
  MediaMultiplexer,
  InitSegmentParser,
  INIT_SEGMENT,
  MEDIA_SEGMENT
};
