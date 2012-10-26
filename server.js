/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, curly:true, browser:true, es5:true, indent:2,
  maxerr:50, node:true, nomen:false */

"use strict";

var fs = require('fs');
var http = require('http');
var url = require('url');
var express = require('express');
var app = express();

app.configure(function () {
  //app.use(express.logger());
  app.set("port", process.env.VCAP_APP_PORT || 8811);
});

app.all('/:year/:month/:day', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

var last = new Date();

function getJSON(aUrl, cb) {
  var file = aUrl.substring(aUrl.lastIndexOf("year"),
                            aUrl.length).replace(/\//g, "_");
  var now = new Date(),
      young = (now - last >= 30 * 1000);
  console.log("now - last", now - last, young);
  var get = function () {
    last = now;
    var jsonresponse = "";
    http.get(url.parse(aUrl), function (res) {
      res.on('data', function (chunk) {
        if (res.statusCode === 200) {
          jsonresponse += chunk;
        }
      });
      res.on('end', function (chunk) {
        if (res.statusCode === 200) {
          fs.writeFile(file, jsonresponse, function (err) {
            if (err) {
              throw err;
            }
          });
          console.log("downloaded", url);
          try {
            var json = JSON.parse(jsonresponse);
            cb(json);
          } catch (e) {
            throw e;
          }
        }
      });
    }).on('error', function (e) {
      console.trace(e);
      console.log("Got error: " + e.message);
      //throw e;
    });
  };
  if (!young) {
    fs.readFile(file, "UTF-8", function (err, data) {
      if (!err) {
        try {
          var json = JSON.parse(data);
          cb(json);
        } catch (e) {
          get();
        }
      }
    });
  } else {
    get();
  }
}

app.get('/:year/:month/:day', function (req, res) {
  var year = req.params.year,
      month = req.params.month,
      day = req.params.day;
  if (typeof year === "undefined" ||
      typeof month === "undefined" ||
      typeof month === "undefined") {
    throw new Error();
  }
  res.contentType('json');
  var url = ['http://gdx.mlb.com/components/game/mlb/',
  'year_', year,
  '/month_', month,
  '/day_', day,
  '/master_scoreboard.json'].join("");
  getJSON(url, function (json) { res.json(json); });
});

app.listen(app.settings.port);
console.log("listening on" + " port " + app.settings.port);
