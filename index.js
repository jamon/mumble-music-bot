import fs from 'fs';
import MusicBot from './musicbot';
import MusicPlayer from './musicplayer';
import p from './promiseMaker';
import util from 'util';

class Main {
    constructor() {
    }
    async start(fileName) {
        console.log("Reading config file (%s)", fileName);
        var config = await this.readJson(fileName);
        console.log("Finished reading config file.", util.inspect(config, {colors: true}));

        this.bot = new MusicBot(config);
        await this.bot.connect(); 
        console.log("Successfully connected to mumble.");
    }
    readFiles(fileNames) {
        return Promise.all(fileNames.map(fileName =>
            p(cb => fs.readFile(fileName, "utf8", cb))
        ));
    }
    readJson(fileName) {
        return p(cb => fs.readFile(fileName, "utf8", cb)).then(JSON.parse);
    }
}
var main = new Main();
main.start("config.json").then(
    () => console.log("success"),
    (err) => console.error("error", err)
);
