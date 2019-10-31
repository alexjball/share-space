import React, { Component } from "react";
import "./Room.css";

// Must match the video stream from the room server, as encoded by FFmpeg.
const mimeType = 'video/webm; codecs="vp9,vorbis"';
const maxLag = 5,
  maxBufferSize = 20,
  playbackSlop = 1,
  bufferSlop = 5;

/**
 * The main interface to spaces, using a websocket.
 *
 * - Maintains a websocket ocnnection to the space server.
 * - Displays the desktop stream
 * - Captures user input for remote desktop control
 */
export default class StreamingMediaSourceVideo extends Component {
  constructor(props) {
    super(props);
    this.state = { status: "Connecting" };
    this.videoRef = React.createRef();
    this.pendingBuffers = [];
    this.perfInfo = [];

    if (!MediaSource.isTypeSupported(mimeType)) {
      throw Error(`MIME type ${mimeType} not supported`);
    }
  }

  connectStream(roomClient) {
    if (this.ws) {
      throw Error("already running");
    }

    const ws = (this.ws = roomClient.openStream());

    ws.onopen = () => {
      this.setPlaybackState({ status: "Connected" });
    };
    ws.onerror = event => {
      this.setPlaybackState({ status: `Error: ${event}` });
    };
    ws.onclose = () => {
      this.setPlaybackState({ status: "Closed" });
    };
    ws.onmessage = ({ data }) => {
      if (this.sourceBuffer) {
        this.logPlayback(this.videoRef.current, data);
        this.updateBuffer(data);
      } else {
        console.log("no sourceBuffer yet");
      }
      this.setPlaybackState({ lastMessageTime: performance.now() });
    };

    const videoSource = (this.videoSource = new MediaSource());
    videoSource.addEventListener("sourceopen", () => {
      this.sourceBuffer = videoSource.addSourceBuffer(mimeType);
      this.sourceBuffer.onupdate = () => this.updateBuffer();
      this.sourceBuffer.onerror = () => (this.sourceBufferErrored = true);
    });

    this.videoRef.current.src = URL.createObjectURL(videoSource);
  }

  setPlaybackState(state) {
    if (this.props.playbackState) {
      this.props.playbackState(state);
    }
  }

  closeStream() {
    if (!this.ws) {
      throw Error("not running");
    }
    this.ws.onopen = null;
    this.ws.onerror = null;
    this.ws.onclose = null;
    this.ws.onmessage = null;
    this.ws.close();
    this.ws = null;
  }

  logPlayback(video, data) {
    if (video.error) {
      console.warn(video.error);
    }

    const now = performance.now();
    this.perfInfo = this.perfInfo.filter(i => now - i.time < 5000);
    this.perfInfo.push({ time: now, length: data.byteLength });
    const averageBitrate =
      (1e-3 * this.perfInfo.map(i => i.length).reduce((a, b) => a + b, 0)) /
      this.perfInfo.length;

    const bufferedRanges = [];
    let i;
    for (i = 0; i < video.buffered.length; i++) {
      bufferedRanges.push([video.buffered.start(i), video.buffered.end(i)]);
    }

    console.log(
      `Current playback time: ${
        video.currentTime
      }. Available seek ahead: ${(video.seekable.length
        ? video.seekable.end(0)
        : 0) -
        video.currentTime}. Buffered ranges: ${bufferedRanges}. Avg bitrate: ${averageBitrate}k/s.`
    );

    this.setPlaybackState({ averageBitrate });
  }

  updateBuffer = newData => {
    if (this.sourceBufferErrored) {
      return;
    }

    if (newData) {
      this.pendingBuffers.push(newData);
    }

    if (this.sourceBuffer.updating) {
      console.warn("sourcebuffer is updating");
      return;
    }

    if (this.pendingBuffers.length) {
      this.sourceBuffer.appendBuffer(this.pendingBuffers.shift());
    } else {
      this.pruneBuffer();
    }
  };

  pruneBuffer = () => {
    if (this.videoRef.current && this.videoRef.current.buffered.length) {
      const buffered = this.videoRef.current.buffered,
        lastBufferStartTime = buffered.start(buffered.length - 1),
        lastBufferEndTime = buffered.end(buffered.length - 1),
        firstBufferStartTime = buffered.start(0),
        currentPlaybackTime = this.videoRef.current.currentTime;

      if (lastBufferEndTime - currentPlaybackTime > maxLag) {
        const newPlaybackTime = Math.max(
          lastBufferStartTime,
          lastBufferEndTime - playbackSlop
        );
        console.log(`Seeking to ${newPlaybackTime}`);
        this.videoRef.current.currentTime = newPlaybackTime;
      }

      if (lastBufferEndTime - firstBufferStartTime > maxBufferSize) {
        const newBufferEndTime = Math.max(
          0,
          Math.min(
            this.videoRef.current.currentTime - bufferSlop,
            lastBufferEndTime - bufferSlop
          )
        );
        console.log(`Removing buffers in range 0, ${newBufferEndTime}`);
        this.sourceBuffer.remove(0, newBufferEndTime);
      }
    }
  };

  componentDidMount() {
    this.connectStream(this.props.roomClient);
  }

  componentWillUnmount() {
    this.closeStream();
  }

  mediaErrorLog(mediaError) {
    const errorCodes = {
      [MediaError.MEDIA_ERR_ABORTED]: "MEDIA_ERR_ABORTED",
      [MediaError.MEDIA_ERR_DECODE]: "MEDIA_ERR_DECODE",
      [MediaError.MEDIA_ERR_NETWORK]: "MEDIA_ERR_NETWORK",
      [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: "MEDIA_ERR_SRC_NOT_SUPPORTED"
    };
    const errorS = errorCodes[mediaError.code] || `UNKNOWN: ${mediaError.code}`;
    return { code: errorS, message: mediaError.message };
  }

  render() {
    const videoError = this.videoRef.current && this.videoRef.current.error;
    let videoErrorLog = null;
    if (videoError) {
      const m = this.mediaErrorLog(videoError);
      videoErrorLog = (
        <div className="video-error">
          <div>Error loading video stream</div>
          <div>Code: {" " + m.code}</div>
          <div>Message: {" " + m.message}</div>
        </div>
      );
    }

    return (
      <div>
        {videoErrorLog}
        <video autoPlay={true} ref={this.videoRef} className="video" />
      </div>
    );
  }
}
