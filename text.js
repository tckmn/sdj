import { fetchJSON, shuffle } from './util.js';

const LS_KEY = 'sdj_seqs_called';

// TODO move these globals into a class or something
let seqData;
const yes = new Set(), no = new Set();

function clear(elt) { while (elt.firstChild) elt.removeChild(elt.firstChild); }
function pad(s, len) { return s.length < len ? '0'+s : s; }

function viewSeq(seq) {
    const cont = document.createElement('div');

    const btns = document.createElement('p');
    const addbtn = (lbl, cb) => {
        const btn = document.createElement('button');
        btn.textContent = lbl;
        btn.addEventListener('click', cb);
        btns.appendChild(btn);
    };
    addbtn('close', () => {
        cont.parentNode.removeChild(cont);
    });
    addbtn('called', () => {
        cont.parentNode.removeChild(cont);
        localStorage.setItem(LS_KEY, (localStorage.getItem(LS_KEY) || '') + seq.date + '.');
        render();
    });
    addbtn('yeet', () => {
        cont.parentNode.appendChild(cont);
    });
    addbtn('yoink', () => {
        cont.parentNode.insertBefore(cont, cont.parentNode.children[1]);
    });
    btns.classList.add('btns');
    cont.appendChild(btns);

    const name = document.createElement('p');
    name.textContent = seq.periphery + ' ' + seq.name;
    name.classList.add('name');
    cont.appendChild(name);

    for (const call of seq.calls) {
        const line = document.createElement('p');
        line.textContent = call;
        cont.appendChild(line);
    }
    document.getElementById('text').appendChild(cont);
}

// dumb lol
function renderTag(s, cls, cb) {
    const t = document.createElement('span');
    if (typeof cls === 'string') t.classList.add(cls);
    else {
        const lbl = document.createElement('span');
        lbl.textContent = '['+cls+']';
        t.appendChild(lbl);
    }
    t.appendChild(document.createTextNode(s));
    t.classList.add('hk');
    t.addEventListener('click', cb);
    return t;
}

function renderSeq(seq, tags) {
    const t = document.createElement('div');
    t.textContent = tags.map(t => `[${t}] `).join('') + `{${seq.calls.length}} ` + seq.name;
    t.addEventListener('click', () => viewSeq(seq));
    return t;
}

function render() {
    const tagsCont = document.getElementById('tags');
    const seqsCont = document.getElementById('seqs');
    clear(tagsCont); clear(seqsCont);

    const tags = new Set(seqData.flatMap(x => x.tags));
    const called = (localStorage.getItem(LS_KEY) || '').split('.');
    const filtered = seqData.filter(seq => {
        if (called.indexOf(seq.date) !== -1) return false;
        const ts = new Set(seq.tags);
        if ([...yes].some(x => !ts.has(x))) return false;
        if ([...no].some(x => ts.has(x))) return false;
        return true;
    });

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
        tagsCont.appendChild(renderTag(s, filtered.filter(seq => seq.tags.indexOf(s) !== -1).length, e => {
            e.preventDefault();
            if (e.ctrlKey) no.add(s);
            else yes.add(s);
            render();
        }));
    }

    for (const seq of filtered) {
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
    let intr, prevStart, stored = 0, sound = true;

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
                if (min >= 10 && sound) {
                    sound = false;
                    time.style.backgroundColor = '#f00';
                }
            }, 33);
        }
    });

    document.getElementById('reset').addEventListener('click', () => {
        if (intr) clearInterval(intr);
        intr = prevStart = undefined;
        stored = 0;
        sound = true;
        time.textContent = '00:00.000';
        time.style.backgroundColor = '';
    });

    document.getElementById('tip').addEventListener('click', () => {
        localStorage.setItem(LS_KEY, (localStorage.getItem(LS_KEY) || '') + '|');
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
        } else if (e.key === 'x') {
            document.getElementById('text').getElementsByTagName('button')[0].click()
        } else if (e.key === 'c') {
            document.getElementById('text').getElementsByTagName('button')[1].click()
        }
    });
});
