import { fetchJSON, shuffle } from './util.js';

// TODO move these globals into a class or something
let seqData;
const yes = new Set(), no = new Set();

function clear(elt) { while (elt.firstChild) elt.removeChild(elt.firstChild); }
function pad(s, len) { return s.length < len ? '0'+s : s; }

function viewSeq(seq) {
    const cont = document.createElement('div');
    for (const call of seq.calls) {
        const line = document.createElement('p');
        line.textContent = call;
        cont.appendChild(line);
    }
    document.getElementById('text').appendChild(cont);
}

function renderTag(s, cls, cb) {
    const t = document.createElement('span');
    t.textContent = s;
    t.classList.add(cls);
    t.classList.add('hk');
    t.addEventListener('click', cb);
    return t;
}

function renderSeq(seq, tags) {
    const t = document.createElement('div');
    t.textContent = tags.map(t => `[${t}] `).join('') + seq.name;
    t.addEventListener('click', () => viewSeq(seq));
    return t;
}

function render() {
    const tagsCont = document.getElementById('tags');
    const seqsCont = document.getElementById('seqs');
    clear(tagsCont); clear(seqsCont);

    const tags = new Set(seqData.flatMap(x => x.tags));

    for (const s of yes) {
        tagsCont.appendChild(renderTag(s, 'yes', () => {
            yes.delete(s);
            render();
        }));
    }

    for (const s of no) {
        tagsCont.appendChild(renderTag(s, 'no', () => {
            no.delete(s);
            render();
        }));
    }

    for (const s of tags) {
        if (yes.has(s) || no.has(s)) continue;
        tagsCont.appendChild(renderTag(s, 'off', e => {
            e.preventDefault();
            if (e.ctrlKey) no.add(s);
            else yes.add(s);
            render();
        }));
    }

    for (const seq of seqData) {
        const ts = new Set(seq.tags);
        if ([...yes].some(x => !ts.has(x))) continue;
        if ([...no].some(x => ts.has(x))) continue;
        seqsCont.appendChild(renderSeq(seq, seq.tags.filter(t => !yes.has(t))));
    }
}

const hotkeys = [
    'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g',
    'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
];

window.addEventListener('load', async () => {
    seqData = await fetchJSON('seq.json');
    render();

    // TODO maybe this goes somewhere else??
    let intr, prevStart, stored = 0;

    document.getElementById('start').addEventListener('click', () => {
        const time = document.getElementById('time');
        if (intr) {
            clearInterval(intr);
            intr = undefined;
            stored = new Date() - prevStart;
        } else {
            prevStart = new Date() - stored;
            intr = setInterval(() => {
                const total = (new Date() - prevStart) / 1000;
                const min = pad(Math.floor(total / 60)+'', 2);
                const sec = pad((total % 60).toFixed(3), 6);
                time.textContent = min+':'+sec;
            }, 33);
        }
    });

    document.getElementById('reset').addEventListener('click', () => {
        if (intr) clearInterval(intr);
        intr = prevStart = undefined;
        stored = 0;
        time.textContent = '00:00.000';
    });

    for (const ipt of document.getElementById('info').getElementsByTagName('input')) {
        ipt.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Escape') ipt.blur();
        });
    }

    // ok this stuff *definitely* goes somewhere else
    let keymap = {};
    document.addEventListener('keydown', e => {
        if (keymap[e.key]) {
            e.stopImmediatePropagation();
            for (const elt of Array.from(document.getElementsByClassName('hkpop'))) {
                elt.parentNode.removeChild(elt);
            }
            if (keymap[e.key].tagName === 'INPUT') keymap[e.key].focus();
            else keymap[e.key].click();
            keymap = {};
        } else if (e.key === 'f') {
            e.stopImmediatePropagation();
            const shuf = shuffle(hotkeys);
            for (const elt of document.getElementsByClassName('hk')) {
                console.log(elt);
                const box = elt.getBoundingClientRect();
                if (box.top > window.innerHeight || box.bottom < 0) continue;
                const hk = shuf.shift();
                if (!hk) break;
                keymap[hk] = elt;
                const popup = document.createElement('div');
                popup.classList.add('hkpop');
                popup.textContent = hk;
                popup.style.top = box.top+'px';
                popup.style.left = box.left+'px';
                document.body.appendChild(popup);
            }
        }
    });
});