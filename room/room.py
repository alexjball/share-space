#!/usr/bin/python3

# Serves a client and API for viewing and controlling a virtual desktop.

from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'
