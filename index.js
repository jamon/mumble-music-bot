import fs from 'fs';
import MusicBot from './musicbot';
import MusicPlayer from './musicplayer';
import p from './promiseMaker';

async function start() {
    var config = await getConfig();
    var mumble = await mumbleConnect(config);
    console.log("connected to mumble");
};
function getConfig() {
    return p(cb => fs.readFile("config.json", "utf8", cb)).then(JSON.parse);
}
function mumbleConnect(config) {
    return Promise.all(
        [config.mumble.key, config.mumble.cert].map(fileName =>
            p(cb => fs.readFile(fileName, "utf8", cb))
        )
    ).then(([key, cert]) => 
        p(cb => (new MusicBot({commandPrefix: "!"})).connect(config.mumble.server, config.mumble.name, {key: key, cert: cert}, cb))
    );
}
start();

