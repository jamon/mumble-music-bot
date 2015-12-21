import PlayMusic from 'playmusic';
import events from 'events';
import p from './promiseMaker';

class MusicPlayer extends events.EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.queue = [];
        this.results = [];
        this.volume = 0.05;
    }
    async connect() {
        this.pm = new PlayMusic();
        return await this.pm.init(this.config);
    }
    setVolume(volume) {
        this.volume = Math.min(1, Math.max(0, volume));
        this.emit("volume", this.volume);
    }
    async search(term, maxResults = 10, type) {
        this.results = await p(cb => this.pm.search(term, maxResults, cb));
        this.emit("searchResults", this.results);
        return this.results;
    }
    queue(resultId, position = this.queue.length, length = 0, extra) {
        this.queue.splice(position, length, {result: this.results[resultId], extra: extra});
        return this.result[resultId];
    }
    play(advance = false) {
        if(advance) this.queue.shift();
        if(this.queue.length === 0) return;
        
    }
}

module.exports = MusicPlayer;
