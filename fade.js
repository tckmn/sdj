export class Fade {
    static RT = 1;
    static GLOBAL = 10;

    constructor() {
        const curveLen = 48000; // pretty arbitrary
        const base = 10;
        this.OUT = new Float32Array(curveLen);
        this.IN = new Float32Array(curveLen);
        for (let i = 0; i < curveLen; i++) {
            const idx = curveLen - 1 - i;
            this.OUT[idx] = Math.log(1 + base*(i/curveLen)) / Math.log(1 + base);
            this.IN[idx] = 1 - this.OUT[idx];
        }
        this.lastFadeEnd = -999;
    }

    ready(t) {
        return t > this.lastFadeEnd;
    }

    fadeOut(gainNode, t, duration) { this.fade(this.OUT, gainNode, t, duration); }
    fadeIn(gainNode, t, duration)  { this.fade(this.IN, gainNode, t, duration); }

    fade(curve, gainNode, t, duration) {
        console.log(t, duration);
        gainNode.gain.setValueCurveAtTime(curve, t, duration);
        this.lastFadeEnd = t + duration;
    }
}
