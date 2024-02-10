export function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.onload = () => resolve(JSON.parse(request.response));
        request.onerror = (e) => reject(e);
        request.send();
    });
}

export function fetchAudio(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = () => resolve(request.response);
        request.onerror = (e) => reject(e);
        request.send();
    });
}

export function decodeAudio(ctx, data) {
    return new Promise((resolve, reject) => {
        ctx.decodeAudioData(data, resolve, reject);
    });
}

export function shuffle(arrin) {
    const arr = arrin.slice();
    for (let i = arr.length - 1; i > 0; --i) {
        const j = Math.random() * (i + 1) | 0;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}
