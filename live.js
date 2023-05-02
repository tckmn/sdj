const eps = 0.1;
const cw = 800, ch = 100, cs = 50;
const colors = {
    waveform:  '#888',
    cut:       '#00f',
    cutActive: '#f0f',
    bar:       '#f00'
};
const widths = {
    bar: 2,
    cut: 3
};
const tickRate = 100;
const lookahead = 0.5;

const fade = 1;
const base = 10;
const curveLen = fade * 48000; // TODO hardcoded ctx.sampleRate to avoid opening context early
const logCurve = new Float32Array(curveLen);
for (let i = 0; i < curveLen; i++) {
    logCurve[curveLen - 1 - i] = Math.log(1 + base*(i/curveLen)) / Math.log(1 + base);
}
const expCurve = new Float32Array(curveLen);
for (let i = 0; i < curveLen; i++) {
    expCurve[i] = 1 - logCurve[i];
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.onload = () => resolve(JSON.parse(request.response));
        request.onerror = (e) => reject(e);
        request.send();
    });
}

function fetchAudio(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = () => resolve(request.response);
        request.onerror = (e) => reject(e);
        request.send();
    });
}

function decodeAudio(ctx, data) {
    return new Promise((resolve, reject) => {
        ctx.decodeAudioData(data, resolve, reject);
    });
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
        const j = Math.random() * (i + 1) | 0;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

async function loadSong(song, opts = {}) {
    document.getElementById('btns').style.display = 'none';

    const ctx = new AudioContext();
    if (opts.play === undefined) ctx.suspend();

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
        track.gain.connect(ctx.destination);
        const data = track.buf.getChannelData(0);
        track.waveform = new Array(cw);
        for (let i = 0; i < cw; ++i) {
            const offset = i*data.length/cw | 0;
            let max = 0, min = 0;
            for (let j = 0; j < data.length / cw; ++j) {
                max = Math.max(max, data[offset + j]);
                min = Math.min(min, data[offset + j]);
            }
            track.waveform[i] = { min, max };
        }
    }));

    const drawContainer = document.getElementById('draw');
    drawContainer.style.paddingBottom = ch+'px';

    const baseCnv = document.getElementById('base');
    baseCnv.setAttribute('width', cw+'px');
    baseCnv.setAttribute('height', ch+'px');
    const baseCtx = baseCnv.getContext('2d');

    const barCnv = document.getElementById('bar');
    barCnv.setAttribute('width', cw+'px');
    barCnv.setAttribute('height', ch+'px');
    const barCtx = barCnv.getContext('2d');
    barCtx.fillStyle = colors.bar;

    let track = tracks[opts.track || 'intro'];
    let startTime;
    let nextTrack;
    let cutActive = -1;

    const xpos = t => Math.max(cw * t / track.buf.duration | 0, 0);

    const fullDraw = target => {
        const wf = target.waveform;
        baseCtx.clearRect(0, 0, cw, ch);
        baseCtx.fillStyle = colors.waveform;
        for (let i = 0; i < cw; ++i) {
            baseCtx.fillRect(i, ch/2 + wf[i].min*cs, 1, (wf[i].max-wf[i].min)*cs);
        }
        for (let i = 0; i < track.cuts.length; ++i) {
            const cut = track.cuts[i];
            baseCtx.fillStyle = cutActive === i ? colors.cutActive : colors.cut;
            baseCtx.fillRect(xpos(cut.t) - Math.ceil(widths.cut/2), 0, widths.cut, ch);
        }
    };

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
        fullDraw(target);
        document.getElementById('status').textContent = 'current: ' + track.name + '; next: ' + (track.next ? track.next.name : '[end]');
    };

    const startScript = (script, t) => {
        start(tracks[script.name], t, script);
    };

    document.getElementById('notes').textContent = Object.entries(song.tracks).map(([k, v]) => `${k}: ${v.buf.duration.toFixed(3)}s`).join('\n') + '\n' + (song.notes || '');
    start(track, ctx.currentTime + eps, { offset: opts.play || 0 });
    msg(`${song.name} is ready`);

    let lastDraw = 0, lastGoto = -fade;

    document.addEventListener('keydown', e => {
        const t = ctx.currentTime;
        if (e.key === 'w') {
            if (cutActive === -1) {
                cutActive = track.cuts.findIndex(cut => t < startTime + cut.t - lookahead);
                if (cutActive === -1) {
                    msg('no cut');
                } else {
                    baseCtx.fillStyle = colors.cutActive;
                    baseCtx.fillRect(xpos(track.cuts[cutActive].t) - Math.ceil(widths.cut/2), 0, widths.cut, ch);
                    msg('cut activated');
                }
            } else {
                baseCtx.fillStyle = colors.cut;
                baseCtx.fillRect(xpos(track.cuts[cutActive].t) - Math.ceil(widths.cut/2), 0, widths.cut, ch);
                cutActive = -1;
                msg('cut deactivated');
            }
        } else if (e.key === 'r') {
            start(tracks.intro, t + eps);
        } else if (/[1-9]/.test(e.key)) {
            const newTrack = track.fades[+e.key - 1];
            if (newTrack) {
                if (track.name === newTrack) {
                    msg('no fade to self');
                } else if (t - lastGoto < fade + eps) {
                    msg('still fading');
                } else {
                    lastGoto = t + eps*2;
                    track.gain.gain.setValueCurveAtTime(logCurve, lastGoto, fade);
                    start(tracks[newTrack], lastGoto, {
                        stopTime: lastGoto + fade,
                        offset: lastGoto - startTime
                    });
                    track.gain.gain.setValueAtTime(0, t+eps);
                    track.gain.gain.setValueCurveAtTime(expCurve, lastGoto, fade);
                }
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const t = ctx.currentTime + eps;
            const offset = Math.max(0, Math.min(track.buf.duration - eps, t - startTime + (e.key === 'ArrowLeft' ? -1 : 1)));
            start(track, t, {
                offset: offset
            });
        } else if (e.key === ' ') {
            if (ctx.state === 'running') {
                ctx.suspend().then(() => msg('paused'));
            } else {
                ctx.resume().then(() => msg('resumed'));
            }
        } else {
            console.log(e.key); // TODO remove
        }
    });

    barCnv.addEventListener('mousedown', e => {
        const t = ctx.currentTime + eps;
        start(track, t, {
            offset: (e.offsetX / cw) * track.buf.duration
        });
    });

    const intr = setInterval(() => {
        const t = ctx.currentTime;
        const endTime = startTime + track.buf.duration;

        barCtx.clearRect(lastDraw - Math.ceil(widths.bar/2), 0, widths.bar, ch);
        lastDraw = xpos(t - startTime);
        barCtx.fillRect(lastDraw - Math.ceil(widths.bar/2), 0, widths.bar, ch);

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

const hotkeys = shuffle([
    'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g',
    'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm'
]);

window.addEventListener('load', async () => {
    const songData = await fetchJSON('songdata.json');
    for (const k of Object.keys(songData)) songData[k].name = k;

    if (location.search) {
        const opts = Object.fromEntries(new URLSearchParams('name=' + location.search.slice(1)).entries());
        void loadSong(songData[opts.name], opts);
        return;
    }

    const keytbl = {};
    const hotkey = e => {
        const btn = keytbl[e.key];
        if (btn) btn.click();
    };
    document.addEventListener('keydown', hotkey);

    const patter = document.getElementById('patter');
    const singer = document.getElementById('singer');

    for (const k of Object.keys(songData).sort()) {
        const btn = document.createElement('button');
        const hk = hotkeys.shift();
        keytbl[hk] = btn;
        btn.textContent = `[${hk}] ${k}`;
        btn.addEventListener('click', () => {
            document.removeEventListener('keydown', hotkey);
            void loadSong(songData[k]);
        });
        (songData[k].flavor === 'patter' ? patter : singer).appendChild(btn);
    }
});
