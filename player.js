import { Draw } from './draw.js';
import { Fade } from './fade.js';
import { fetchAudio, decodeAudio } from './util.js';

const EPS = 0.1;
const TICK_RATE = 20;
const LOOKAHEAD = 0.5;

export class Player {

    constructor(elts) {
        // these are all immutable
        this.elts = elts;

        this.ctx = new AudioContext();
        this.main = this.ctx.createGain();
        this.main.connect(this.ctx.destination);

        this.draw = new Draw(this.elts.draw);
        this.fade = new Fade();

        // this one is mutable (kind of a hack here)
        this.intr = undefined;

        document.addEventListener('keydown', this.onKey.bind(this));
        this.draw.ev(this.onDrawEv.bind(this));
    }

    msg(s) { this.elts.msg.textContent = `[${this.ctx.currentTime.toFixed(3)}] ${s}`; }

    start(target, t, opts = {}) {
        this.paused = opts.paused;
        const offset = opts.offset || 0;
        if (this.track.source) this.track.source.stop(opts.stopTime || t);
        if (this.cutActive !== -1 && (this.track !== target || offset >= this.track.cuts[this.cutActive].t - LOOKAHEAD)) this.cutActive = -1;
        this.track = target;
        this.startTime = t - offset;
        target.source = this.ctx.createBufferSource();
        target.source.buffer = target.buf;
        target.source.connect(target.gain);
        if (!this.paused) target.source.start(t, offset);
        this.draw.draw(target, this.cutActive);
        this.elts.status.textContent = 'current: ' + target.name + '; next: ' + (target.next ? target.next.name : '[end]');
    }

    startScript(script, t) {
        this.start(this.tracks[script.name], t, script);
    }

    onKey(e) {
        if (this.intr === undefined) {
            if (e.key === ' ') e.preventDefault();
            return;
        }

        const t = this.ctx.currentTime;
        const cutColor = { w: 0, q: 1 }[e.key];
        if (cutColor !== undefined) {
            if (this.cutActive === -1) {
                this.cutActive = this.track.cuts.findIndex(cut => (cut.color || 0) === cutColor && t < this.startTime + cut.t - LOOKAHEAD);
                if (this.cutActive === -1) {
                    this.msg('no cut');
                } else {
                    this.draw.cut(this.track, this.track.cuts[this.cutActive], 1);
                    this.msg('cut activated');
                }
            } else {
                this.draw.cut(this.track, this.track.cuts[this.cutActive], 0);
                this.cutActive = -1;
                this.msg('cut deactivated');
            }
        } else if (e.key === 'r') {
            this.start(this.tracks.intro, t + EPS, { stopTime: t });
        } else if (e.key === 'e') {
            this.msg('fadeout');
            this.fade.fadeOut(this.main, t+EPS, Fade.GLOBAL);
        } else if (/[1-9]/.test(e.key)) {
            const newTrack = this.track.fades && this.track.fades[+e.key - 1];
            if (newTrack) {
                if (this.track.name === newTrack) {
                    this.msg('no fade to self');
                } else if (!this.fade.ready(t)) {
                    this.msg('still fading');
                } else {
                    const fadeTime = t + EPS*2;
                    this.fade.fadeOut(this.track.gain, fadeTime, Fade.RT);
                    this.start(this.tracks[newTrack], fadeTime, {
                        stopTime: fadeTime + Fade.RT,
                        offset: fadeTime - this.startTime
                    });
                    this.track.gain.gain.setValueAtTime(0, t+EPS);
                    this.fade.fadeIn(this.track.gain, fadeTime, Fade.RT);
                }
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const t = this.ctx.currentTime + EPS;
            const offset = Math.max(0, Math.min(this.track.buf.duration - EPS, t - this.startTime + (e.key === 'ArrowLeft' ? -1 : 1)));
            this.start(this.track, t, {
                offset: offset
            });
        } else if (e.key === ' ') {
            e.preventDefault();
            if (this.paused) {
                this.msg('unpausing');
                this.paused = false;
                this.startTime = t+EPS;
                this.track.source.start(this.startTime);
            } else if (this.ctx.state === 'running') {
                this.ctx.suspend().then(() => this.msg('paused'));
            } else {
                this.ctx.resume().then(() => this.msg('resumed'));
            }
        } else if (e.key === 'm') {
            if (this.fade.ready(t)) this.fade.fadeScaled(this.main.gain.value, 0.125, this.main, t+EPS, Fade.VOL); else this.msg('not ready');
        } else if (e.key === ',') {
            if (this.fade.ready(t)) this.fade.fadeScaled(this.main.gain.value, 0.25, this.main, t+EPS, Fade.VOL); else this.msg('not ready');
        } else if (e.key === '.') {
            if (this.fade.ready(t)) this.fade.fadeScaled(this.main.gain.value, 0.5, this.main, t+EPS, Fade.VOL); else this.msg('not ready');
        } else if (e.key === '/') {
            if (this.fade.ready(t)) this.fade.fadeScaled(this.main.gain.value, 1, this.main, t+EPS, Fade.VOL); else this.msg('not ready');
        } else if (e.key === '\\') {
            this.unload();
        } else {
            console.log(e.key); // TODO remove
        }
    }

    onTick() {
        if (this.paused) return;

        const t = this.ctx.currentTime;
        const endTime = this.startTime + this.track.buf.duration;

        this.draw.bar(this.track, t - this.startTime);

        if (t >= endTime) {
            this.paused = true;
            this.msg('ended');
        } else if (this.cutActive >= 0 && this.startTime + this.track.cuts[this.cutActive].t - t < LOOKAHEAD) {
            this.startScript(this.track.cuts[this.cutActive].dest, this.startTime + this.track.cuts[this.cutActive].t);
        } else if (endTime - t < LOOKAHEAD && this.track.next) {
            this.startScript(this.track.next, endTime);
        }

        if (this.track.bpm) {
            const beat = this.track.bpm[0] * (t - this.startTime - this.track.bpm[1]) / 60;
            this.elts.metronome.style.backgroundColor = beat % 1 < 0.25 ? beat % 4 < 1 ? '#ff0' : '#4b0' : '#585858';
        }
    }

    onDrawEv(offset) {
        if (this.intr === undefined) return;
        const t = this.ctx.currentTime + EPS;
        this.start(this.track, t, {
            offset: offset * this.track.buf.duration
        });
    }

    async load(song, opts = {}) {
        this.elts.btns.style.display = 'none';

        if (opts.play === undefined) this.ctx.suspend();

        // these are all mutable
        this.tracks = song.tracks;
        this.msg(`loading ${song.name}...`);

        await Promise.all(Object.entries(this.tracks).map(async ([f, track]) => {
            track.name = f;
            if (!track.cuts) track.cuts = [];
            track.buf = await decodeAudio(this.ctx, await fetchAudio(`snd/${song.name}/${f}.ogg`));
            if (track.cuts.length && track.cuts[track.cuts.length-1].t === 0) {
                track.cuts[track.cuts.length-1].t = track.buf.duration;
            }
            track.gain = this.ctx.createGain();
            track.gain.connect(this.main);
            track.waveform = this.draw.waveform(track.buf.getChannelData(0));
        }));

        this.track = this.tracks[opts.track || 'intro'];
        this.startTime = undefined;
        this.nextTrack = undefined;
        this.cutActive = -1;
        this.paused = false;

        this.elts.notes.textContent = Object.entries(this.tracks).map(([k, v]) => `${k}: ${v.buf.duration.toFixed(3)}s`).join('\n') + '\n' + (song.notes || '');
        this.start(this.track, this.ctx.currentTime + EPS, { offset: opts.play || 0 });
        this.msg(`${song.name} is ready`);

        this.intr = setInterval(this.onTick.bind(this), TICK_RATE);
    }

    unload() {
        clearInterval(this.intr);
        this.intr = undefined;

        for (const track of Object.values(this.tracks)) {
            track.gain.disconnect();
        }

        this.elts.status.textContent = '';
        this.elts.notes.textContent = '';
        this.elts.metronome.style.backgroundColor = '#585858';
        this.draw.clear();
        this.msg('unloaded');

        this.elts.btns.style.display = '';
    }

}
