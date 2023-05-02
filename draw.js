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

export class Draw {
    constructor(container) {
        this.container = container;
        this.container.style.paddingBottom = ch+'px';

        this.baseCnv = document.createElement('canvas');
        this.baseCnv.setAttribute('width', cw+'px');
        this.baseCnv.setAttribute('height', ch+'px');
        this.baseCtx = this.baseCnv.getContext('2d');
        this.container.appendChild(this.baseCnv);

        this.barCnv = document.createElement('canvas');
        this.barCnv.setAttribute('width', cw+'px');
        this.barCnv.setAttribute('height', ch+'px');
        this.barCtx = this.barCnv.getContext('2d');
        this.barCtx.fillStyle = colors.bar;
        this.container.appendChild(this.barCnv);

        this.lastDraw = 0;
    }

    #xpos(track, t) { return Math.max(cw * t / track.buf.duration | 0, 0); }

    draw(track, cutActive) {
        const wf = track.waveform;
        this.baseCtx.clearRect(0, 0, cw, ch);
        this.baseCtx.fillStyle = colors.waveform;
        for (let i = 0; i < cw; ++i) {
            this.baseCtx.fillRect(i, ch/2 + wf[i].min*cs, 1, (wf[i].max-wf[i].min)*cs);
        }
        for (let i = 0; i < track.cuts.length; ++i) {
            const cut = track.cuts[i];
            this.cut(track, track.cuts[i].t, cutActive === i);
        }
    }

    cut(track, t, active) {
        this.baseCtx.fillStyle = active ? colors.cutActive : colors.cut;
        this.baseCtx.fillRect(this.#xpos(track, t) - Math.ceil(widths.cut/2), 0, widths.cut, ch);
    }

    bar(track, t) {
        this.barCtx.clearRect(this.lastDraw - Math.ceil(widths.bar/2), 0, widths.bar, ch);
        this.lastDraw = this.#xpos(track, t);
        this.barCtx.fillRect(this.lastDraw - Math.ceil(widths.bar/2), 0, widths.bar, ch);
    }

    ev(fn) {
        this.barCnv.addEventListener('click', e => fn(e.offsetX / cw));
    }

    waveform(data) {
        const arr = new Array(cw);
        for (let i = 0; i < cw; ++i) {
            const offset = i*data.length/cw | 0;
            let max = 0, min = 0;
            for (let j = 0; j < data.length / cw; ++j) {
                max = Math.max(max, data[offset + j]);
                min = Math.min(min, data[offset + j]);
            }
            arr[i] = { min, max };
        }
        return arr;
    }
}
