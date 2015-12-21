/* eslint-env node */
import util from 'util';
import fs from 'fs';
import https from 'https';
import http from 'http';
import url from 'url';

import mumble from 'mumble';
//import lame from 'lame';
import lwip from 'lwip';
//import arrayShuffle from 'array-shuffle';
import async from 'async';
import React from 'react';

import CommandParser from './src/commands.js';

class MusicBot {
    constructor(config) {
        this.player = config.player;
        this.commandPrefix = config.commandPrefix;
        this.clients = [];
    }
    connect(server, name, mumbleOptions, callback) {
        return mumble.connect(server, mumbleOptions, (err, client) => {
            if(err) return callback(err);
            client.authenticate(name);
            client.on('initialized', () => this.onInitialized(client, callback));
            client.on('message', this.onMessage.bind(this));
        });
    }
    onInitialized(client, callback) {
        this.clients.push(client);
        callback(null, client);
    }
    onMessage(message, user, scope) {
        if(message.charAt(0) !== this.config.commandPrefix) return;
        let command;
        try {
            command = CommandParser.parse(message);
            console.log("command: ", command);
        } catch (e) {
            user.sendMessage(this.render(<ErrorParsingCommand error={e} />)); 
        }

    }
    render(element) {
        try {
            return React.renderToStaticMarkup(element);
        } catch (e) {
            console.log("error rendering component", e);
            return ""
        }
    }
    getLwipImageType(mimeType) {
        let imageTypes = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/gif": "gif"
        };
        return imageTypes[mimeType];
    }
    getAndShrinkImage(urlString, callback) {
        async.waterfall([
            callback => this.getUrl(urlString, callback),
            (res, callback) => lwip.open(res.body, this.getLwipImageType(res.headers['content-type']), callback),
            (image, callback) => image.contain(75, 75, "white", "lanczos", callback),
            (image, callback) => image.toBuffer("png", {}, callback)
        ], callback);
    }
    getUrl(urlString, callback) {
        let handlers = {"http:": http, "https:": https};

        let parsedUrl = url.parse(urlString);
        let handler = handlers[parsedUrl.protocol];
        if(!handler) callback(Error("No handler for protocol: " + parsedUrl.protocol));

        let bufs = [];
        let req = handler.request(parsedUrl, function(res) {
            res.on('data', d => bufs.push(d));
            res.on('end', function() {
                res.body = Buffer.concat(bufs);
                if(typeof callback === "function") callback(null, res);
            });
            res.on('error', err => callback(err));
        });
        req.end();
    }
}

const ErrorParsingCommand = React.createClass({
    render() {
        return <div>
            <span style={{fontWeight: "bold", color: "#d00000", marginRight: "1em"}}>Error parsing command:</span>
            <span>{this.props.error && this.props.error.toString()}</span>
        </div>;
    }
});
const QueuedTrack = React.createClass({
    render() {
        return <div>
            {typeof this.props.image !== "undefined" ? <img style={{float: "left"}} src={"data:image/png;base64," + imgSrc} /> : null}
            <div style={{float: "left", paddingLeft: 15}}>
                <h3>{this.props.track.artist}</h3>
                <p style={{marginTop: 5}}>{this.props.track.title}</p>
                <p style={{fontStyle: "italic", margin: 0}}>(requested by {this.props.userName})</p>
            </div>
        </div>;
    }
});

module.exports = MusicBot;
/*
mb.getAndShrinkImage("http://lh3.ggpht.com/glnJ4FZ4nE6Zphn5OysD1Tzfs8oWdGlsp34wCp5AGTYaplxgwiPxpD9SIKuzBbDrDgFuRqXbRg", function(err, result) {
    if(err) return console.error(err);
    var image = result.toString("base64");
    var track = {
        artist: "Bastille",
        title: "Things we lost in the fire"
    };
    var message = React.renderToStaticMarkup(<QueuedTrack image={image} track={track} userName="Jamon" />);
    console.log(message);
});
*/
// pm.init(config, function(err) {
//     if(err) console.error(err);
// });

//
// var locked = false;
// var playStream, decoderStream, mumbleStream;
// var sessions = {};
// var results = [];
// var volume = 0.06;
// var queue = [];
// var playing = false;
// var client = mumble.connect(
//     config.mumble.server,
//     {
//         key: fs.readFileSync(config.mumble.key, 'utf8'),
//         cert: fs.readFileSync(config.mumble.cert, 'utf8')
//     }, function(err, connection) {
//     if(err) { throw new Error(err); }
//
//     var checkQueue = function() {
//         if(playing || queue.length === 0) return;
//         var next = queue.shift();
//         play(next.track, next.userName);
//     };
//     var play = function(track, userName) {
//         getImage(track.albumArtRef[0].url, function(err, data) {
//             if(err) console.error("error loading album art", err);
//             console.log("loaded album art...");
//             var img = "<img style='float: left;' src=\"data:image/jpg;base64," + data + "\" />";
//             var message = [
//                 img,
//                 "<div style='float: left; padding-left: 15px; margin-top: -50px; background: #fff;'>",
//                     "<h3 style='margin: 0;'>", track.artist, "</h3>",
//                     "<p style='margin-top: 5px;'>", track.title, "</p>",
//                     "<p style='font-style: italic; margin: 0;'>", " (requested by ", userName, ")", "</p>",
//                 "</div>",
//                 track.primaryVideo ? "<div><a href='http://www.youtube.com/watch?v=" + track.primaryVideo.id + "'>youtube</a></div>" : ""
//             ].map(function(e) {
//                 return typeof e === "undefined" ? "" : e.replace("&", "&amp;", "g");
//             }).join("\n");
//             //console.log("message:", message);
//             connection.user.channel.sendMessage(message);
//         });
//         pm.getStreamUrl(track.storeId, function(err, streamUrl) {
//             if(err) {
//                 console.error(err);
//                 respond("Error: " + err.toString());
//                 return;
//             }
//
//             var req = https.request(url.parse(streamUrl), function(streamRes) {
//                 playStream = streamRes;
//                 decoderStream = lame.Decoder();
//                 playStream.pipe(decoderStream);
//                 decoderStream.on('format', function(format) {
//                     if(typeof mumbleStream !== "undefined" && typeof mumbleStream.close === "function") mumbleStream.close();
//                     mumbleStream = connection.inputStream({channels: format.channels, sampleRate: format.sampleRate, gain: volume})
//                     decoderStream.pipe(mumbleStream);
//                     mumbleStream.on('finish', function() {
//                         console.log("#####################, finish!!!!");
//                         playing = false;
//                         checkQueue();
//                     });
//                 });
//             });
//             req.end();
//         });
//     };
//     var playTrack = function(track, userName, next) {
//         if(!playing) {
//             playing = true;
//             play(track, userName);
//         } else {
//             var queueItem = {track: track, userName: userName};
//             if(next) {
//                 queue.unshift(queueItem);
//             } else {
//                 queue.push(queueItem);
//             }
//         }
//     };
//
//     connection.authenticate('MusicBot');
//     connection.on('initialized', function() {
//         console.log('Connection initialized');
//     });
//     connection.on('textMessage', function(event) {
//         console.log(util.inspect(event));
//         var users = connection.users();
//         var user = connection.userBySession(event.actor);
//         var me = connection.user;
//         var respond = function(message) {
//             if(event.channelId) {
//                 me.channel.sendMessage(message);
//             } else {
//                 user.sendMessage(message);
//             }
//         };
//         var userName = user.name;
//         if(locked && userName !== "Jamon") return;
//         console.log(userName + ":", event.message);
//         if(event.message.match(/^stop|st[a]+[h]+p|eat shit/i)) {
//             if(typeof mumbleStream !== "undefined" && typeof mumbleStream.close === "function") mumbleStream.close();
//             playing = false;
//             checkQueue();
//         } else if(event.message.match(/^clearqueue/i)) {
//             if(typeof mumbleStream !== "undefined" && typeof mumbleStream.close === "function") mumbleStream.close();
//             playing = false;
//             queue = [];
//         } else if(event.message.match(/^lock/i)) {
//             locked = true;
//         } else if(event.message.match(/^unlock/i)) {
//             locked = false;
//         } else if(event.message.match(/^volume /i)) {
//             var vol = parseInt(event.message.substr(6), 10);
//             if(vol >= 0 && vol <= 100) {
//                 volume = vol / 100;
//                 me.channel.sendMessage("volume set to " + vol);
//             } else {
//                 user.sendMessage("volume requested is out of bounds, try 0-100");
//             }
//         } else if(event.message.match(/^search /i)) {
//             searchText = event.message.substr(6);
//             console.log("searching for", searchText);
//             pm.search(searchText, 10, function(err, res) {
//                 if(err) {
//                     console.error(err);
//                     respond("Error:" + err.toString());
//                     return;
//                 }
//                 if(!Array.isArray(res.entries)) {
//                     respond("Not Found");
//                     return;
//                 }
//
//                 results = res.entries.filter(function(r) { return r.type === '1'; });
//                 var tracks = results.map(function(t, i) {
//                     var d = t.track.durationMillis;
//                     var duration = "";
//                     var m = Math.floor(d / 60000);
//                     if(m > 0) duration += m + "m";
//                     var s = Math.floor((d % 60000)/1000);
//                     if(s > 0) duration += s + "s";
//                     var m = [i, t.track.artist, t.track.title, duration].join(" - ");
//                     return m;
//                 });
//                 respond("Tracks Found: <br>" + tracks.join("<br>"));
//                 console.log(util.inspect(tracks, {depth: null, colors: true}));
//             });
//         } else if(event.message.match(/^queuerm /)) {
//             var num = parseInt(event.message.substr(8));
//             var item = queue.splice(num, 1);
//             var q = item[0];
//             if(item) {
//                 var message = "<div>removed " + q.track.artist + " - " + q.track.title + " (" + q.userName + ")</div>".replace("&", "&amp;", "g");
//                 connection.user.channel.sendMessage(message);
//             }
//         } else if(event.message.match(/^queuetop /)) {
//             var num = parseInt(event.message.substr(8));
//             var item = queue.splice(num, 1);
//             var q = item[0];
//             queue.unshift(q);
//             if(item) {
//                 var message = "<div>removed " + q.track.artist + " - " + q.track.title + " (" + q.userName + ")</div>".replace("&", "&amp;", "g");
//                 connection.user.channel.sendMessage(message);
//             }
//         } else if(event.message.match(/^queuerand/)) {
//             arrayShuffle(queue);
//             var message = "<div>randomized queue</div>";
//             connection.user.channel.sendMessage(message);
//         } else if(event.message.match(/^queue/)) {
//             var num = parseInt(event.message.substr(5));
//
//             var message = queue.map(function(q, i) {
//                 return "<div>(" + i + ") " + q.track.artist + " - " + q.track.title + " (" + q.userName + ")</div>".replace("&", "&amp;", "g");
//             });
//             connection.user.channel.sendMessage(message.join("\n"));
//
//         } else if(event.message.match(/^radio /i)) {
//             var num = parseInt(event.message.substr(5));
//             console.log("attempting to start radio on#", num, util.inspect(results[num], {color: true, depth: 10}));
//             if(!results[num]) return;
//             var track = results[num].track;
//
//             pm.createStation("radio123", track.storeId, "track", function(err, data) {
//                 if(err) return console.error(err);
//                 pm.getStationTracks(data.mutate_response[0].id, 10, function(err, resp) {
//                     if(err) return console.error(err);
//                     var tracks = resp.data.stations[0].tracks;
//                     tracks.forEach(function(t) {
//                         playTrack(t, userName);
//                     });
//                     var message = tracks.map(function(t) {
//                         return "<div>" + t.artist + " - " + t.title + "</div>".replace("&", "&amp;", "g");
//                     });
//                     message.unshift("<div>Station based on " + track.artist + " - " + track.title + "</div>");
//                     message.push("<span style='font-style: italic;'>&nbsp;&nbsp;&nbsp;requested by" + userName + "</span>");
//                     connection.user.channel.sendMessage(message.join("\n"));
//                 });
//             });
//
//         } else if(event.message.match(/^playnext /i)) {
//             var num = parseInt(event.message.substr(9));
//             console.log("attempting to play #", num, util.inspect(results[num], {color: true, depth: 10}));
//             if(!results[num]) return;
//             var track = results[num].track;
//
//             var message = [
//                 "<span>queued (next): ", track.artist, " - ", track.title, "</span>",
//                 "<span>", " (requested by ", userName, ")", "</span>"
//             ].map(function(e) {
//                 return typeof e === "undefined" ? "" : e.replace("&", "&amp;", "g");
//             }).join("\n");
//             connection.user.channel.sendMessage(message);
//             playTrack(track, userName, true);
//         } else if(event.message.match(/^play /i)) {
//             var num = parseInt(event.message.substr(5));
//             console.log("attempting to play #", num, util.inspect(results[num], {color: true, depth: 10}));
//             if(!results[num]) return;
//             var track = results[num].track;
//
//             var message = [
//                 "<span>queued: ", track.artist, " - ", track.title, "</span>",
//                 "<span>", " (requested by ", userName, ")", "</span>"
//             ].map(function(e) {
//                 return typeof e === "undefined" ? "" : e.replace("&", "&amp;", "g");
//             }).join("\n");
//             connection.user.channel.sendMessage(message);
//             playTrack(track, userName);
//         }
//     });
//     connection.on('userState', function(state) {
//         sessions[state.session] = state;
//     });
// });
