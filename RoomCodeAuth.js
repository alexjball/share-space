const Passport = require("passport").Passport;
const LocalStrategy = require("passport-local").Strategy;
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
var cors = require("cors");

let userId = 0;

module.exports = class RoomCodeAuth {
  constructor() {
    this.roomCode = process.env.ROOM_CODE || "share-space";
    this.passport = new Passport();
    this._configure();
  }

  _configure() {
    this.passport.use(
      new LocalStrategy(
        {
          usernameField: "username",
          passwordField: "password",
          session: true
        },
        (username, roomCode, done) => {
          if (roomCode == this.roomCode) {
            return done(null, { name: username, id: userId++ });
          }
          return done(null, false, { message: "Incorrect room code." });
        }
      )
    );

    this.passport.serializeUser((user, done) => {
      done(null, user);
    });

    this.passport.deserializeUser((user, done) => {
      done(null, user);
    });
  }

  _getSession() {
    if (!this.session) {
      this.session = session({ secret: "share-space" });
    }
    return this.session;
  }

  checkAuth(request, callback) {
    this._getSession()(request, {}, err => {
      if (err) {
        callback(err);
      } else if (request.session.passport && request.session.passport.user) {
        callback(null, request.session.passport.user);
      } else {
        callback(Error("User not authenticated"));
      }
    });
  }

  requireAuth() {
    const router = express.Router();
    // Issue session cookies at correct /login, else 401
    router.post(
      "/login",
      cors({ origin: true, credentials: true }),
      this.passport.authenticate("local", { session: true }),
      (req, res, next) => {
        console.log(`Authorized user: ${JSON.stringify(req.user)}`);
        res.send(req.user);
      }
    );

    // All other requests must be issued with a session cookie, which is
    // loaded into req.user by passport.session(), else 401.
    router.use("/", (req, res, next) => {
      if (!req.user) {
        res.sendStatus(401);
      } else {
        next();
      }
    });

    // Add an endpoint to test the session cookie
    router.get(
      "/test",
      cors({ origin: true, credentials: true }),
      (req, res) => {
        res.send("test\n");
        console.log("test");
      }
    );
    return router;
  }

  middleware() {
    return [
      this._getSession(),
      bodyParser.urlencoded({ extended: false }),
      this.passport.initialize(),
      this.passport.session()
    ];
  }
};
