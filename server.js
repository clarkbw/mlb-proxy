/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, curly:true, browser:true, es5:true, indent:2,
  maxerr:50, node:true, nomen:false */

"use strict";

var fs = require("promised-io/fs");
var http = require('http');
var url = require('url');
var express = require('express');
var app = express();
var moment = require('moment');

app.configure(function () {
  app.use(express.logger());
  app.set("port", process.env.VCAP_APP_PORT || 8811);
});

app.all('/:year/:month/:day', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

var last = moment();
var timeout = moment.duration(2, 'minutes').asSeconds();

var Deferred = require("promised-io/promise").Deferred;

function getFromMLB(MLB_URL) {
  var deferred = new Deferred();
  var jsonresponse = "";
  http.get(url.parse(MLB_URL), function (res) {
    res.on('data', function (chunk) {
      if (res.statusCode === 200) {
        jsonresponse += chunk;
      }
    });
    res.on('end', function (chunk) {
      if (res.statusCode === 200) {
        try {
          var json = JSON.parse(jsonresponse);
          deferred.resolve(json);
        } catch (e) {
          deferred.reject(e);
        }
      }
    });
  }).on('error', function (e) {
    console.trace(e);
    console.log("Got error: " + e.message);
    deferred.reject(e);
  });
  return deferred.promise;
}

function getJSON(year, month, day) {
  var deferred = new Deferred();

  var MLB_URL = ['http://gdx.mlb.com/components/game/mlb/',
  'year_', year,
  '/month_', month,
  '/day_', day,
  '/master_scoreboard.json'].join("");
  var file = MLB_URL.substring(MLB_URL.lastIndexOf("year"),
                               MLB_URL.length).replace(/\//g, "_");

  var now = moment(),
      today = moment().hours(0).minutes(0).seconds(0).milliseconds(0),
      requested = moment([year, month - 1, day]).hours(0).minutes(0).seconds(0).milliseconds(0),
      isToday = requested.diff(today, 'days') === 0,
      hasTimedOut = (now.diff(last, 'seconds') >= timeout);

  if (isToday &&
      hasTimedOut) {
    last = now;
    getFromMLB(MLB_URL).then(function success(json) {
      fs.writeFile(file, JSON.stringify(json));
      deferred.resolve(json);
    });
  } else {
    fs.readFile(file, "UTF-8").then(
                                function success(data) {
                                  deferred.resolve(JSON.parse(data));
                                },
                                function fail(err) {
                                  getFromMLB(MLB_URL).then(function success(json) {
                                    fs.writeFile(file, JSON.stringify(json));
                                    deferred.resolve(json);
                                  },
                                  function failure(err) {
                                    deferred.reject(err);
                                  });
                                }
    );
  }
  return deferred.promise;
}

app.get('/:year/:month/:day', function (req, res) {
  var year = req.params.year,
      month = req.params.month,
      day = req.params.day;
  if (typeof year === "undefined" ||
      typeof month === "undefined" ||
      typeof day === "undefined") {
    throw new Error();
  }
  res.contentType('json');
  getJSON(year, month, day).then(function success(json) { res.json(json); },
                                 function failure(err) { throw err; });
});

app.listen(app.settings.port);
console.log("listening on" + " port " + app.settings.port);
