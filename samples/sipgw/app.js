/*global require, __dirname, console*/
var express = require('express'),
    fs = require("fs"),
    https = require("https");

if (!__dirname) {
  __dirname = require("path").dirname(fs.readlinkSync('/proc/self/exe'));
}

var app = express();

app.configure(function () {
    "use strict";
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(function (req, res, next) {
        "use strict";
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
        res.header('Access-Control-Allow-Headers', 'origin, content-type');
        if (req.method == 'OPTIONS') {
            res.send(200);
        }
        else {
            next();
        }
    });
    app.use(express.static(__dirname + '/public'));
});

app.listen(3001);

var options = {
  key: fs.readFileSync(__dirname + '/cert/key.pem').toString(),
  cert: fs.readFileSync(__dirname + '/cert/cert.pem').toString(),
  passphrase: "abc123"
};
var server = https.createServer(options, app);
server.listen(3004);
