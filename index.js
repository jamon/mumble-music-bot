import fs from 'fs';
import MusicBot from './musicbot';
import MusicPlayer from './musicplayer';
import p from './promiseMaker';


class MumbleMusicBot {
    constructor() {
    }
    async start(fileName) {
        console.log("Reading config file (%s)", fileName);
        var config = await this.readJson(fileName);
        console.log("Finished reading config file.");
        var mumble = await this.mumbleConnect(config);
        console.log("Successfully connected to mumble.");
    }
    readJson(fileName) {
        return p(cb => fs.readFile(fileName, "utf8", cb)).then(JSON.parse);
    }
    readFiles(fileNames) {
        return Promise.all(fileNames.map(fileName =>
            p(cb => fs.readFile(fileName, "utf8", cb))
        ));
    }
    async mumbleConnect(config) {
        console.log("Reading client certificate (%s) and key (%s) from disk.", config.mumble.key, config.mumble.cert);
        var [key, cert] = await this.readFiles([config.mumble.key, config.mumble.cert]);
        console.log("Finished reading client certificate and key from disk.");
        this.musicBot = new MusicBot({commandPrefix: "!"});
        return p(cb => this.musicBot.connect(config.mumble.server, config.mumble.name, {key: key, cert: cert}, cb));
    }
}
var mmb = new MumbleMusicBot();
mmb.start("config.json");
