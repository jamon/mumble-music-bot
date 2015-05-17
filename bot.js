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
var volume = 0.1;
var client = mumble.connect('mumble://a1ive.org', options, function(error, connection) {
    if(error) { throw new Error(error); }

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
                    var m = [i, t.track.artist, t.track.title].join(" - ");
                    return m;
                });
                respond("Tracks Found: <br>" + tracks.join("<br>"));
                console.log(util.inspect(tracks, {depth: null, colors: true}));
            });
        } else if(event.message.match(/^play /i)) {
            var num = parseInt(event.message.substr(5));
            console.log("attempting to play #", num, util.inspect(results[num], {color: true, depth: 10}));
            if(!results[num]) return;
            var track = results[num].track;
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
                    });
                });
                req.end();
            });
        }
    });
    connection.on('userState', function(state) {
        sessions[state.session] = state;
    });
});
