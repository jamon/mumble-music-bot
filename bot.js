var mumble = require('mumble');
var fs = require('fs');
var util = require('util');
var https = require('https');
var url = require('url');
var PlayMusic = require('playmusic');
var pm = new PlayMusic();
var pmConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var avconv = require('avconv');

pm.init(pmConfig, function() {});
var options = {
    key: fs.readFileSync('private.pem', 'utf8'),
    cert: fs.readFileSync('public.pem', 'utf8')
}

var stream;
var sessions = {};
var results = [];
var avstream;
var volume = 64;
var speed = 22050;
mumble.connect('mumble://a1ive.org', options, function(error, connection) {
    if(error) { throw new Error(error); }

    connection.authenticate('MusicBot');
    connection.on('initialized', function() {
        console.log('Connection initialized');
        stream = connection.outputStream();
    });
    connection.on('textMessage', function(event) {
        console.log(util.inspect(event));
        var users = connection.users();
        var user = users.filter(function(u) { return u.session === event.actor; })[0];
        var me = connection.user;
        var respond = function(message) {
            if(event.channelId) {
                me.channel.sendMessage(message);
            } else {
                user.sendMessage(message);
            }
        };
        var userName = sessions[event.actor].name;

        console.log(userName + ":", event.message);
        if(event.message.match(/^stop|st[a]+[h]+p|eat shit/i)) {
            if(typeof avstream !== "undefined" && typeof avstream.unpipe === "function") avstream.unpipe();
        } else if(event.message.match(/^volume /i)) {
            var vol = parseInt(event.message.substr(6), 10);
            if(vol >= 2 && vol <= 256) {
                volume = vol;
                me.channel.sendMessage("volume set to " + vol);
            } else {
                user.sendMessage("volume requested is out of bounds, try 16-256");
            }
        } else if(event.message.match(/^speed /i)) {
            var spd = parseInt(event.message.substr(5), 10);
            if(spd >= 11000 && spd <= 48000) {
                speed = spd;
                me.channel.sendMessage("speed set to " + spd);
            } else {
                user.sendMessage("speed requested is out of bounds, try 11000-48000");
            }
        } else if(event.message.match(/^search /i)) {
            searchText = event.message.substr(6);
            console.log("searching for", searchText);
            pm.search(searchText, 3, function(res) {
                if(!Array.isArray(res.entries)) {
                    respond("Not Found");
                    return;
                }

                results = res.entries.filter(function(r) { return r.type === '1'; });
                var tracks = results.map(function(t, i) {
                    var m = [i, t.track.artist, t.track.title].join(" - ");
                    respond(m);
                    return m;
                });
                console.log(util.inspect(tracks, {depth: null, colors: true}));
            }, console.error);
        } else if(event.message.match(/^play /i)) {
            if(typeof avstream !== "undefined" && typeof avstream.unpipe === "function") avstream.unpipe();
            var num = parseInt(event.message.substr(5));
            console.log("attempting to play #", num, results[num]);
            if(!results[num]) return;
            var track = results[num].track;
            me.channel.sendMessage("Playing " + track.artist + " - " + track.title + " (requested by " + userName + ")");
            pm.getStreamUrl(track.storeId, function(streamUrl) {
                avstream = avconv(['-i', 'pipe:0', '-vol', volume,'-f', 's16le',  '-acodec', 'pcm_s16le', '-ar', speed,  'pipe:1']);
                var req = https.request(url.parse(streamUrl), function(streamRes) {
                    streamRes.pipe(avstream);
                    avstream.on('message', function(data) {
                        console.log('message', util.inspect(data));
                    });
                    avstream.on('progress', function(data) {
                        console.log("progress", data);
                    });
                    avstream.on('error', function(data) {
                        console.log("error", util.inspect(data));
                    });

                    avstream.pipe(connection.inputStream());
                });
                req.end();
            });
        }
    });
    connection.on('userState', function(state) {
        sessions[state.session] = state;
    });
});
