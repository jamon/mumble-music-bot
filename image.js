/* jshint esnext: true */
//require('babel-runtime/core-js/promise').default = require('bluebird');
/*
import util from 'util';
import fs from 'fs';
import https from 'https';
import http from 'http';
import url from 'url';

import lwip from 'lwip';

class Image {
    constructor() {}
    static get(imageUrlString, callback) {
        var imageUrl = url.parse(imageUrlString);
        var handler = this._getHandler(imageUrl.protocol);
        if(!handler) callback(new Error("No handler for protocol: " + imageUrl.protocol));
    }
    static _getHandler(protocol) {
        const handlers = {"http:": http, "https:": https};
        return handlers[protocol];
    }
} */

var util = require('util');
var fs = require('fs');
var https = require('https');
var http = require('http');
var url = require('url');

var async = require('async');
var lwip = require('lwip');
var promise = require('bluebird');

var getImage = function(imageUrl, callback) {
    var bufs = [];
    var req = http.request(url.parse(imageUrl), function(res) {
        //console.log(res.headers);
        // @TODO read image type from content-type header
        var imageType = imageTypes[res.headers['content-type']];
        if(!imageType) return callback("Unknown image type: " + res.headers['content-type']);
        res.on('data', function(d) {
            bufs.push(d);
        });

        res.on('end', function() {
            //console.log("...downloaded");
            var buf = Buffer.concat(bufs);
            lwip.open(buf, imageType, function(err, image) {
                if(err) return callback(err);
                //console.log("...open");
                image.contain(75, 75, "white", "lanczos", function(err, image) {
                    if(err) return callback(err);
                    //console.log("...contained");
                    image.toBuffer("jpg", {}, function(err, jpg) {
                        if(err) return callback(err);
                        //console.log("...to jpeg");
                        callback(null, jpg.toString('base64'));
                    });
                });
            })
        });
        res.on('error', function(err) {
            callback(err);
        });
    });
    req.end();
};
