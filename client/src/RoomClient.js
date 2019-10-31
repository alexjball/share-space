/**
 * Client interface to a room server, hides transport details
 */
export default class RoomClient {
  constructor(roomServer, protocol = "wss") {
    this.roomServer = roomServer;

    switch (protocol) {
      case "http":
      case "ws":
        this.protocol = {
          ws: "ws",
          http: "http"
        };
        break;
      case "https":
      case "wss":
        this.protocol = {
          ws: "wss",
          http: "https"
        };
        break;
      default:
        throw Error(`Invalid protocol ${protocol}`);
    }
  }

  openStream() {
    const ws = new WebSocket(`${this.protocol.ws}://${this.roomServer}/stream`);
    ws.binaryType = "arraybuffer";
    return ws;
  }

  getControlUrl() {
    return "ws://share-space-dev:6080/";
    // return `${this.protocol.ws}://${this.roomServer}/control`;
  }

  logIn(roomCode) {
    return fetch(`${this.protocol.http}://${this.roomServer}/login`, {
      method: "POST",
      body: `username=client&password=${roomCode}`,
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }).then(response => {
      if (response.status !== 200) {
        throw Error(`Login error ${response.status}`);
      }
      return response.json();
    });
  }

  testAuth() {
    return fetch(`${this.protocol.http}://${this.roomServer}/test`, {
      method: "GET",
      credentials: "include"
    });
  }
}
