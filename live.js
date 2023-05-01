const eps = 0.1;
const cw = 800, ch = 100, cs = 50;
const colors = {
    waveform:  '#444',
    cut:       '#00f',
    cutActive: '#f0f',
    bar:       '#f00'
};
const tickRate = 100;
const lookahead = 0.5;

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

async function load() {

    const ctx = new AudioContext();

    const tracks = {
        intro: {
            next: 'main'
        },
        main: {
            next: 'main',
            cuts: [
                {t: 15.237, dest: 'outro'},
                {t: 30.473, dest: 'outro'},
                {t: 45.706, dest: 'outro'},
                {t: 60.951, dest: 'outro'},
                // {t: 76.189, dest: 'outro'},
                {t: 91.427, dest: 'outro'},
                {t: 106.661, dest: 'outro'},
                {t: 121.905, dest: 'outro'},
                {t: 139.042, dest: 'outro'},
                {t: 0, dest: 'outro'},
            ]
        },
        outro: {
            next: undefined
        }
    };

    for (const [f, track] of Object.entries(tracks)) {
        track.name = f;
        if (!track.cuts) track.cuts = [];
        track.buf = await decodeAudio(ctx, await fetchAudio(`snd/flowerdance/${f}.ogg`));
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
    }

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
            baseCtx.fillRect(xpos(cut.t) - 2, 0, 3, ch);
        }
    };

    const start = (target, t, offset = 0) => {
        if (track.source) track.source.stop(t);
        track = target;
        cutActive = -1;
        startTime = t - offset;
        target.source = ctx.createBufferSource();
        target.source.buffer = target.buf;
        target.source.connect(target.gain);
        target.source.start(t, offset);
        fullDraw(target);
        document.getElementById('status').textContent = 'current: ' + track.name + '; next: ' + track.next;
    };

    const msgEl = document.getElementById('msg');
    const msg = s => {
        msgEl.textContent = `[${ctx.currentTime.toFixed(3)}] ${s}`;
    };

    msg('ready');

    document.addEventListener('keydown', e => {
        const t = ctx.currentTime;
        switch (e.key) {
            case 'q':
                start(track, t + eps);
                break;
            case 'w':
                if (cutActive === -1) {
                    cutActive = track.cuts.findIndex(cut => t < startTime + cut.t - lookahead);
                    if (cutActive === -1) {
                        msg('no cut');
                    } else {
                        baseCtx.fillStyle = colors.cutActive;
                        baseCtx.fillRect(xpos(track.cuts[cutActive].t) - 1, 0, 3, ch);
                        msg('cut activated');
                    }
                } else {
                    baseCtx.fillStyle = colors.cut;
                    baseCtx.fillRect(xpos(track.cuts[cutActive].t) - 1, 0, 3, ch);
                    cutActive = -1;
                    msg('cut deactivated');
                }
                break;
        }
    });

    barCnv.addEventListener('mousedown', e => {
        const t = ctx.currentTime + eps;
        start(track, t, (e.offsetX / cw) * track.buf.duration);
    });

    let lastDraw = 0;
    const intr = setInterval(() => {
        const t = ctx.currentTime;
        const endTime = startTime + track.buf.duration;

        barCtx.clearRect(lastDraw, 0, 1, ch);
        lastDraw = xpos(t - startTime);
        barCtx.fillRect(lastDraw, 0, 1, ch);

        if (t >= endTime) {
            clearInterval(intr);
            msg('ended');
        } else if (cutActive >= 0 && startTime + track.cuts[cutActive].t - t < lookahead) {
            start(tracks[track.cuts[cutActive].dest], startTime + track.cuts[cutActive].t);
        } else if (endTime - t < lookahead && track.next) {
            start(tracks[track.next], endTime);
        }
    }, tickRate);

}

async function loadCeleste() {
    const ctx = new AudioContext();
    const lvls = await Promise.all(['00intro', '01city', '02oldsite', '03resort', '04cliffside', '06finale']
        .map(async f => {
            const buf = await decodeAudio(ctx, await fetchAudio(`snd/mus_lvl7_summit_${f}.ogg`));
            const source = ctx.createBufferSource();
            const gain = ctx.createGain();
            gain.gain.value = 0;
            source.buffer = buf;
            source.connect(gain).connect(ctx.destination);
            return {
                source, gain
            };
        }));
    lvls[0].gain.gain.value = 1;
    const fade = 1;

    const base = 10;
    const curveLen = fade * ctx.sampleRate;

    let logCurve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
        logCurve[curveLen - 1 - i] = Math.log(1 + base*(i/curveLen)) / Math.log(1 + base);
    }

    let expCurve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
        expCurve[i] = 1 - logCurve[i];
    }

    const msgEl = document.getElementById('msg');
    const msg = s => {
        msgEl.textContent = `[${ctx.currentTime}] ${s}`;
    };

    msg('ready');

    let i = 0, lastGoto = -fade;
    const goto = j => {
        const t = ctx.currentTime;
        if (t - lastGoto < fade + eps) {
            msg('still fading');
        } else {
            lastGoto = t;
            lvls[i].gain.gain.setValueCurveAtTime(logCurve, t, fade);
            lvls[i = j].gain.gain.setValueCurveAtTime(expCurve, t, fade);
        }
    };

    document.addEventListener('keydown', function(e) {
        switch (e.key) {
            case 'q':
                const t = ctx.currentTime + eps;
                for (const lvl of lvls) {
                    lvl.source.start(t, 40);
                }
                break;
            case '1': goto(0); break;
            case '2': goto(1); break;
            case '3': goto(2); break;
            case '4': goto(3); break;
            case '5': goto(4); break;
            case '6': goto(5); break;
        }
    });
}


window.addEventListener('load', () => {
    loadFlower();
});
