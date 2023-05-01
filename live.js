const ctx = new AudioContext();

const eps = 0.1;
const cw = 800, ch = 100, cs = 50;
const colors = {
    waveform:  '#444',
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

const trackData = {

    flowerdance: {
        intro: {
            next: { name: 'main' }
        },
        main: {
            next: { name: 'main' },
            cuts: [
                {t: 15.237, dest: { name: 'outro' }},
                {t: 30.473, dest: { name: 'outro' }},
                {t: 45.706, dest: { name: 'outro' }},
                {t: 60.951, dest: { name: 'outro' }},
                {t: 91.427, dest: { name: 'outro' }},
                {t: 106.661, dest: { name: 'outro' }},
                {t: 121.905, dest: { name: 'outro' }},
                {t: 139.042, dest: { name: 'outro' }},
                {t: 0, dest: { name: 'outro' }}
            ]
        },
        outro: {
            next: undefined
        }
    },

    summit: {
        intro: {
            next: { name: 'intro', offset: 38.441 },
            fades: ['intro', 'city', 'oldsite', 'resort', 'cliffside', 'finale']
        },
        city: {
            next: { name: 'city', offset: 38.441 },
            fades: ['intro', 'city', 'oldsite', 'resort', 'cliffside', 'finale']
        },
        oldsite: {
            next: { name: 'oldsite', offset: 38.441 },
            fades: ['intro', 'city', 'oldsite', 'resort', 'cliffside', 'finale']
        },
        resort: {
            next: { name: 'resort', offset: 38.441 },
            fades: ['intro', 'city', 'oldsite', 'resort', 'cliffside', 'finale']
        },
        cliffside: {
            next: { name: 'cliffside', offset: 38.441 },
            fades: ['intro', 'city', 'oldsite', 'resort', 'cliffside', 'finale']
        },
        finale: {
            next: { name: 'finale', offset: 38.441 },
            fades: ['intro', 'city', 'oldsite', 'resort', 'cliffside', 'finale']
        }
    },

};

const fade = 1;
const base = 10;
const curveLen = fade * ctx.sampleRate;
const logCurve = new Float32Array(curveLen);
for (let i = 0; i < curveLen; i++) {
    logCurve[curveLen - 1 - i] = Math.log(1 + base*(i/curveLen)) / Math.log(1 + base);
}
const expCurve = new Float32Array(curveLen);
for (let i = 0; i < curveLen; i++) {
    expCurve[i] = 1 - logCurve[i];
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

async function load(song) {

    const tracks = trackData[song];

    await Promise.all(Object.entries(tracks).map(async ([f, track]) => {
        track.name = f;
        if (!track.cuts) track.cuts = [];
        track.buf = await decodeAudio(ctx, await fetchAudio(`snd/${song}/${f}.ogg`));
        if (track.cuts.length) {
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

    let track = tracks.intro;
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
        baseCtx.fillStyle = colors.cut;
        for (const cut of track.cuts) {
            baseCtx.fillRect(xpos(cut.t) - Math.ceil(widths.cut/2), 0, widths.cut, ch);
        }
    };

    const start = (target, t, opts = {}) => {
        if (track.source) track.source.stop(opts.stopTime || t);
        track = target;
        cutActive = -1;
        startTime = t - (opts.offset || 0);
        target.source = ctx.createBufferSource();
        target.source.buffer = target.buf;
        target.source.connect(target.gain);
        target.source.start(t, opts.offset || 0);
        fullDraw(target);
        document.getElementById('status').textContent = 'current: ' + track.name + '; next: ' + track.next.name;
    };

    const startScript = (script, t) => {
        start(tracks[script.name], t, script);
    };

    const msgEl = document.getElementById('msg');
    const msg = s => {
        msgEl.textContent = `[${ctx.currentTime.toFixed(3)}] ${s}`;
    };

    msg('ready');

    let lastDraw = 0, lastGoto = -fade;

    document.addEventListener('keydown', e => {
        const t = ctx.currentTime;
        if (e.key === 'q') {
            start(track, t + eps);
        } else if (e.key === 'w') {
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


window.addEventListener('load', () => {
    const btns = document.getElementById('btns');
    for (const k of Object.keys(trackData)) {
        const btn = document.createElement('button');
        btn.textContent = k;
        btn.addEventListener('click', () => {
            load(k);
            btns.style.display = 'none';
        });
        btns.appendChild(btn);
    }
});
