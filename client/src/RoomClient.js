/**
 * Client interface to a room server, hides transport details
 */
export default class RoomClient {
  constructor(roomServer, protocol = "wss") {
    this.roomServer = roomServer;

    switch (protocol) {
      case "http":
      case "ws":
        this.protocol = "ws";
        break;
      case "https":
      case "wss":
        this.protocol = "wss";
        break;
      default:
        throw Error(`Invalid protocol ${protocol}`);
    }
  }

  openStream() {
    const ws = new WebSocket(`${this.protocol}://${this.roomServer}/stream`);
    ws.binaryType = "arraybuffer";
    return ws;    
  }

  getControlUrl() {
    return "ws://share-space-dev:6080/";
    // return new WebSocket(`${this.protocol}://${this.roomServer}/control`);
  }
}
