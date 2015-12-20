import PlayMusic from 'playmusic';
import events from 'events';
import p from './promiseMaker';

class MusicPlayer extends events.EventEmitter {
    constructor(playMusic) {
        super();
        this.pm = playMusic;
        this.queue = [];
        this.volume = 0.05;
    }
    setVolume(volume) {
        this.volume = Math.min(1, Math.max(0, volume));
        this.emit("volume", this.volume);
    }
    queue(trackIds, position, length, requestor, callback) {
        async.map(trackIds,
            (trackId, callback) => this.getTrack(trackId, (err, track) => 
                callback(err, {track: track, requestor: requestor})),
            (err, queueItems) => {
                if(Number.isInteger(position) && position >= 0 && position < this.queue.length) {
                    this.queue.splice.apply(
                        this.queue,
                        [position, Number.isInteger(position) ? position : 0].concat(queueItems)
                    );
                } else {
                    this.queue.push(queueItems);
                }
                callback(null, queueItems);
            }
        );
    }
    queuePush(trackId, requestor, callback) {

    }
    queueSplice(index, length) {
        this.queue.splice(index, length);
        if(index === 0) this.stop();
    }
}

module.exports = MusicPlayer;
