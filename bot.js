var mumble = require('mumble');
var fs = require('fs');
var util = require('util');
var https = require('https');
var http = require('http');
var url = require('url');
var PlayMusic = require('playmusic');
var lame = require('lame');
var pm = new PlayMusic();
var pmConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var lwip = require('lwip');

pm.init(pmConfig, function(err) {
    if(err) console.error(err);
});
var options = {
    key: fs.readFileSync('private.pem', 'utf8'),
    cert: fs.readFileSync('public.pem', 'utf8')
}

var imageTypes = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif"
};
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


var locked = false;
var playStream, decoderStream, mumbleStream;
var sessions = {};
var results = [];
var volume = 0.06;
var queue = [];
var playing = false;
var client = mumble.connect('mumble://a1ive.org', options, function(error, connection) {
    if(error) { throw new Error(error); }


    var checkQueue = function() {
        if(playing || queue.length === 0) return;
        var next = queue.shift();
        play(next.track, next.userName);
    };
    var play = function(track, userName) {
        getImage(track.albumArtRef[0].url, function(err, data) {
            if(err) console.error("error loading album art", err);
            console.log("loaded album art...");
            var img = "<img style='float: left;' src=\"data:image/jpg;base64," + data + "\" />";
            var message = [
                img,
                "<div style='float: left; padding-left: 15px; margin-top: -50px; background: #fff;'>",
                    "<h3 style='margin: 0;'>", track.artist, "</h3>",
                    "<p style='margin-top: 5px;'>", track.title, "</p>",
                    "<p style='font-style: italic; margin: 0;'>", " (requested by ", userName, ")", "</p>",
                "</div>",
                track.primaryVideo ? "<div><a href='http://www.youtube.com/watch?v=" + track.primaryVideo.id + "'>youtube</a></div>" : ""
            ].map(function(e) {
                return typeof e === "undefined" ? "" : e.replace("&", "&amp;", "g");
            }).join("\n");
            //console.log("message:", message);
            connection.user.channel.sendMessage(message);
        });
        pm.getStreamUrl(track.storeId, function(err, streamUrl) {
            if(err) {
                console.error(err);
                respond("Error: " + err.toString());
                return;
            }

            var req = https.request(url.parse(streamUrl), function(streamRes) {
                playStream = streamRes;
                decoderStream = lame.Decoder();
                playStream.pipe(decoderStream);
                decoderStream.on('format', function(format) {
                    if(typeof mumbleStream !== "undefined" && typeof mumbleStream.close === "function") mumbleStream.close();
                    mumbleStream = connection.inputStream({channels: format.channels, sampleRate: format.sampleRate, gain: volume})
                    decoderStream.pipe(mumbleStream);
                    mumbleStream.on('finish', function() {
                        console.log("#####################, finish!!!!");
                        playing = false;
                        checkQueue();
                    });
                });
            });
            req.end();
        });
    };
    var playTrack = function(track, userName, next) {
        if(!playing) {
            playing = true;
            play(track, userName);
        } else {
            var queueItem = {track: track, userName: userName};
            if(next) {
                queue.unshift(queueItem);
            } else {
                queue.push(queueItem);
            }
        }
    };

    connection.authenticate('MusicBot');
    connection.on('initialized', function() {
        console.log('Connection initialized');
    });
    connection.on('textMessage', function(event) {
        console.log(util.inspect(event));
        var users = connection.users();
        var user = connection.userBySession(event.actor);
        var me = connection.user;
        var respond = function(message) {
            if(event.channelId) {
                me.channel.sendMessage(message);
            } else {
                user.sendMessage(message);
            }
        };
        var userName = user.name;
        if(locked && userName !== "Jamon") return;
        console.log(userName + ":", event.message);
        if(event.message.match(/^stop|st[a]+[h]+p|eat shit/i)) {
            if(typeof mumbleStream !== "undefined" && typeof mumbleStream.close === "function") mumbleStream.close();
            playing = false;
            checkQueue();
        } else if(event.message.match(/^clearqueue/i)) {
            if(typeof mumbleStream !== "undefined" && typeof mumbleStream.close === "function") mumbleStream.close();
            playing = false;
            queue = [];
        } else if(event.message.match(/^lock/i)) {
            locked = true;
        } else if(event.message.match(/^unlock/i)) {
            locked = false;
        } else if(event.message.match(/^volume /i)) {
            var vol = parseInt(event.message.substr(6), 10);
            if(vol >= 0 && vol <= 100) {
                volume = vol / 100;
                me.channel.sendMessage("volume set to " + vol);
            } else {
                user.sendMessage("volume requested is out of bounds, try 0-100");
            }
        } else if(event.message.match(/^search /i)) {
            searchText = event.message.substr(6);
            console.log("searching for", searchText);
            pm.search(searchText, 10, function(err, res) {
                if(err) {
                    console.error(err);
                    respond("Error:" + err.toString());
                    return;
                }
                if(!Array.isArray(res.entries)) {
                    respond("Not Found");
                    return;
                }

                results = res.entries.filter(function(r) { return r.type === '1'; });
                var tracks = results.map(function(t, i) {
                    var d = t.track.durationMillis;
                    var duration = "";
                    var m = Math.floor(d / 60000);
                    if(m > 0) duration += m + "m";
                    var s = Math.floor((d % 60000)/1000);
                    if(s > 0) duration += s + "s";
                    var m = [i, t.track.artist, t.track.title, duration].join(" - ");
                    return m;
                });
                respond("Tracks Found: <br>" + tracks.join("<br>"));
                console.log(util.inspect(tracks, {depth: null, colors: true}));
            });
        } else if(event.message.match(/^queue/)) {
            var num = parseInt(event.message.substr(5));

            var message = queue.map(function(q) {
                return "<div>" + q.track.artist + " - " + q.track.title + " (" + q.userName + ")</div>".replace("&", "&amp;", "g");
            });
            connection.user.channel.sendMessage(message.join("\n"));

        } else if(event.message.match(/^radio /i)) {
            var num = parseInt(event.message.substr(5));
            console.log("attempting to start radio on#", num, util.inspect(results[num], {color: true, depth: 10}));
            if(!results[num]) return;
            var track = results[num].track;

            pm.createStation("radio123", track.storeId, "track", function(err, data) {
                if(err) return console.error(err);
                pm.getStationTracks(data.mutate_response[0].id, 10, function(err, resp) {
                    if(err) return console.error(err);
                    var tracks = resp.data.stations[0].tracks;
                    tracks.forEach(function(t) {
                        playTrack(t, userName);
                    });
                    var message = tracks.map(function(t) {
                        return "<div>" + t.artist + " - " + t.title + "</div>".replace("&", "&amp;", "g");
                    });
                    message.unshift("<div>Station based on " + track.artist + " - " + track.title + "</div>");
                    message.push("<span style='font-style: italic;'>&nbsp;&nbsp;&nbsp;requested by" + userName + "</span>");
                    connection.user.channel.sendMessage(message.join("\n"));
                });
            });

        } else if(event.message.match(/^playnext /i)) {
            var num = parseInt(event.message.substr(9));
            console.log("attempting to play #", num, util.inspect(results[num], {color: true, depth: 10}));
            if(!results[num]) return;
            var track = results[num].track;

            var message = [
                "<span>queued (next): ", track.artist, " - ", track.title, "</span>",
                "<span>", " (requested by ", userName, ")", "</span>"
            ].map(function(e) {
                return typeof e === "undefined" ? "" : e.replace("&", "&amp;", "g");
            }).join("\n");
            connection.user.channel.sendMessage(message);
            playTrack(track, userName, true);
        } else if(event.message.match(/^play /i)) {
            var num = parseInt(event.message.substr(5));
            console.log("attempting to play #", num, util.inspect(results[num], {color: true, depth: 10}));
            if(!results[num]) return;
            var track = results[num].track;

            var message = [
                "<span>queued: ", track.artist, " - ", track.title, "</span>",
                "<span>", " (requested by ", userName, ")", "</span>"
            ].map(function(e) {
                return typeof e === "undefined" ? "" : e.replace("&", "&amp;", "g");
            }).join("\n");
            connection.user.channel.sendMessage(message);
            playTrack(track, userName);
        }
    });
    connection.on('userState', function(state) {
        sessions[state.session] = state;
    });
});
