import { Draw } from './draw.js';
import { Fade } from './fade.js';
import { fetchAudio, fetchJSON, decodeAudio } from './util.js';

const eps = 0.1;
const tickRate = 100;
const lookahead = 0.5;

async function loadSong(song, opts = {}) {
    document.getElementById('btns').style.display = 'none';

    const ctx = new AudioContext();
    const main = ctx.createGain();
    main.connect(ctx.destination);
    if (opts.play === undefined) ctx.suspend();

    const draw = new Draw(document.getElementById('draw'));
    const fade = new Fade();

    const msgEl = document.getElementById('msg');
    const msg = s => {
        msgEl.textContent = `[${ctx.currentTime.toFixed(3)}] ${s}`;
    };

    const tracks = song.tracks;
    msg(`loading ${song.name}...`);

    await Promise.all(Object.entries(tracks).map(async ([f, track]) => {
        track.name = f;
        if (!track.cuts) track.cuts = [];
        track.buf = await decodeAudio(ctx, await fetchAudio(`snd/${song.name}/${f}.ogg`));
        if (track.cuts.length && track.cuts[track.cuts.length-1].t === 0) {
            track.cuts[track.cuts.length-1].t = track.buf.duration;
        }
        track.gain = ctx.createGain();
        track.gain.connect(main);
        track.waveform = draw.waveform(track.buf.getChannelData(0));
    }));

    let track = tracks[opts.track || 'intro'];
    let startTime;
    let nextTrack;
    let cutActive = -1;

    const start = (target, t, opts = {}) => {
        const offset = opts.offset || 0;
        if (track.source) track.source.stop(opts.stopTime || t);
        if (cutActive !== -1 && (track !== target || offset >= track.cuts[cutActive].t - lookahead)) cutActive = -1;
        track = target;
        startTime = t - offset;
        target.source = ctx.createBufferSource();
        target.source.buffer = target.buf;
        target.source.connect(target.gain);
        target.source.start(t, offset);
        draw.draw(target, cutActive);
        document.getElementById('status').textContent = 'current: ' + track.name + '; next: ' + (track.next ? track.next.name : '[end]');
    };

    const startScript = (script, t) => {
        start(tracks[script.name], t, script);
    };

    document.getElementById('notes').textContent = Object.entries(song.tracks).map(([k, v]) => `${k}: ${v.buf.duration.toFixed(3)}s`).join('\n') + '\n' + (song.notes || '');
    start(track, ctx.currentTime + eps, { offset: opts.play || 0 });
    msg(`${song.name} is ready`);

    document.addEventListener('keydown', e => {
        const t = ctx.currentTime;
        if (e.key === 'w') {
            if (cutActive === -1) {
                cutActive = track.cuts.findIndex(cut => t < startTime + cut.t - lookahead);
                if (cutActive === -1) {
                    msg('no cut');
                } else {
                    draw.cut(track, track.cuts[cutActive].t, 1);
                    msg('cut activated');
                }
            } else {
                draw.cut(track, track.cuts[cutActive].t, 0);
                cutActive = -1;
                msg('cut deactivated');
            }
        } else if (e.key === 'r') {
            start(tracks.intro, t + eps);
        } else if (e.key === 'e') {
            msg('fadeout');
            fade.fadeOut(main, t+eps, Fade.GLOBAL);
        } else if (/[1-9]/.test(e.key)) {
            const newTrack = track.fades[+e.key - 1];
            if (newTrack) {
                if (track.name === newTrack) {
                    msg('no fade to self');
                } else if (!fade.ready(t)) {
                    msg('still fading');
                } else {
                    const fadeTime = t + eps*2;
                    fade.fadeOut(track.gain, fadeTime, Fade.RT);
                    start(tracks[newTrack], fadeTime, {
                        stopTime: fadeTime + Fade.RT,
                        offset: fadeTime - startTime
                    });
                    track.gain.gain.setValueAtTime(0, t+eps);
                    fade.fadeIn(track.gain, fadeTime, Fade.RT);
                }
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const t = ctx.currentTime + eps;
            const offset = Math.max(0, Math.min(track.buf.duration - eps, t - startTime + (e.key === 'ArrowLeft' ? -1 : 1)));
            start(track, t, {
                offset: offset
            });
        } else if (e.key === ' ') {
            e.preventDefault();
            if (ctx.state === 'running') {
                ctx.suspend().then(() => msg('paused'));
            } else {
                ctx.resume().then(() => msg('resumed'));
            }
        } else {
            console.log(e.key); // TODO remove
        }
    });

    draw.ev(offset => {
        const t = ctx.currentTime + eps;
        start(track, t, {
            offset: offset * track.buf.duration
        });
    });

    const intr = setInterval(() => {
        const t = ctx.currentTime;
        const endTime = startTime + track.buf.duration;

        draw.bar(track, t - startTime);

        if (t >= endTime) {
            clearInterval(intr);
            msg('ended');
        } else if (cutActive >= 0 && startTime + track.cuts[cutActive].t - t < lookahead) {
            startScript(track.cuts[cutActive].dest, startTime + track.cuts[cutActive].t);
        } else if (endTime - t < lookahead && track.next) {
            startScript(track.next, endTime);
        }
    }, tickRate);

}

window.addEventListener('load', async () => {
    const songData = await fetchJSON('songdata.json');
    for (const k of Object.keys(songData)) songData[k].name = k;

    if (location.search) {
        const opts = Object.fromEntries(new URLSearchParams('name=' + location.search.slice(1)).entries());
        void loadSong(songData[opts.name], opts);
        return;
    }

    const patter = document.getElementById('patter');
    const singer = document.getElementById('singer');

    for (const k of Object.keys(songData).sort()) {
        const btn = document.createElement('button');
        btn.classList.add('hk');
        btn.textContent = k;
        btn.addEventListener('click', () => {
            void loadSong(songData[k]);
        });
        (songData[k].flavor === 'patter' ? patter : singer).appendChild(btn);
    }
});
