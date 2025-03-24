import { fetchJSON, shuffle } from './util.js';

const LS_CONFIG = 'sdj_config_';
const LS_SEQS = 'sdj_seqs_called';
const LS_NOTEPAD = 'sdj_notepad';

const CONFIG = [
    {
        name: 'hotkeys',
        default: false,
        onchange: () => {}
    },
    {
        name: 'birds',
        default: false,
        onchange: () => {}
    },
    {
        name: 'tagunion',
        default: false,
        onchange: () => render()
    }
];

const conf = {};
for (const cdata of CONFIG) {
    const local = localStorage.getItem(LS_CONFIG + cdata.name);
    conf[cdata.name] = local === undefined ? cdata.default : local === 'true';
}

const ACTIONS = [
    {
        name: `copy data (${(localStorage.getItem(LS_SEQS) || '').split('.').length - 1})`,
        onactivate: () => navigator.clipboard.writeText(localStorage.getItem(LS_SEQS))
    },
    {
        name: 'clear data',
        onactivate: () => { if (prompt('type "yes" to confirm') === 'yes') localStorage.removeItem(LS_SEQS); }
    }
]

// TODO move these globals into a class or something
let seqData; let listData;
const yes = new Set(), no = new Set();

function clear(elt) { while (elt.firstChild) elt.removeChild(elt.firstChild); }
function pad(s, len) { return s.length < len ? '0'+s : s; }
function tagnorm(t) { return t.split('.')[0]; }

function viewSeq(seq) {
    const cont = document.createElement('div');
    cont.classList.add('seqdisp');

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
        localStorage.setItem(LS_SEQS, (localStorage.getItem(LS_SEQS) || '') + seq.date + '.');
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

    const playback = document.getElementById('playback');
    const calls = document.createElement('div');
    calls.classList.add('calls');
    for (const call of seq.calls) {
        const line = document.createElement('p');
        line.textContent = conf.birds ? call[0]
            .replace(/boy/g, 'lark')
            .replace(/girl/g, 'robin')
            .replace(/BOY/g, 'LARK')
            .replace(/GIRL/g, 'ROBIN')
            : call[0];
        line.addEventListener('pointerenter', e => {
            playback.innerHTML = call[1].join('\n').replace(/\d[GB]./g, m =>
                `<span class='role${m[1]}'>${m.replace('<','&lt;').replace('>','&gt;')}</span>`
            );
            const rect = playback.getBoundingClientRect();
            playback.style.top = (e.clientY-rect.height-20)+'px';
            playback.style.left = (e.clientX-rect.width-10)+'px';
            playback.classList.remove('hidden');
        });
        line.addEventListener('pointermove', e => {
            const rect = playback.getBoundingClientRect();
            playback.style.top = (e.clientY-rect.height-20)+'px';
            playback.style.left = (e.clientX-rect.width-10)+'px';
        });
        line.addEventListener('pointerleave', e => {
            playback.classList.add('hidden');
        });
        calls.appendChild(line);
    }
    cont.appendChild(calls);
    document.getElementById('text').appendChild(cont);
}

// dumb lol
function renderTag(s, cls, cb) {
    const t = document.createElement('span');
    if (typeof cls === 'string') t.classList.add(cls);
    else {
        if (!conf.tagunion && cls === 0) return document.createTextNode('');
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

    const tags = new Set(seqData.flatMap(x => x.tags).filter(x => x[0] !== '@').map(tagnorm));
    const called = (localStorage.getItem(LS_SEQS) || '').replace(/\|/g, '').split('.');
    const filtered = seqData.filter(seq => {
        if (called.indexOf(seq.date) !== -1) return false;
        const ts = new Set(seq.tags.map(tagnorm));
        if (conf.tagunion ?
            yes.size && ![...yes].some(x => ts.has(x)) :
            [...yes].some(x => !ts.has(x))) return false;
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
        tagsCont.appendChild(renderTag(s, (conf.tagunion ? seqData : filtered).filter(seq => seq.tags.map(tagnorm).indexOf(s) !== -1).length, e => {
            e.preventDefault();
            if (e.ctrlKey) no.add(s);
            else yes.add(s);
            render();
        }));
    }

    for (const seq of filtered) {
        // intentionally no tagnorm to show unnormalized versions
        seqsCont.appendChild(renderSeq(seq, seq.tags.filter(t => conf.tagunion || !yes.has(t))));
    }
}

const keylist = [
    'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g',
    'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
];

function parseListData(txt) {
    return Object.fromEntries(txt.split(/^%/m).slice(1).map(group => {
        const idx = group.indexOf('\n');
        return [group.slice(0, idx), group.slice(idx+1)];
    }));
}

window.addEventListener('load', async () => {
    seqData = await fetchJSON('seq.json');
    listData = parseListData(await (await fetch('lists.txt')).text());
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
        localStorage.setItem(LS_SEQS, (localStorage.getItem(LS_SEQS) || '') + '|');
    });

    for (const ipt of document.getElementById('info').getElementsByTagName('input')) {
        ipt.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Escape') ipt.blur();
        });
    }

    const notepad = document.getElementById('notepad');
    notepad.value = localStorage.getItem(LS_NOTEPAD) || '';
    notepad.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') e.target.blur();
    });
    notepad.addEventListener('input', e => {
        localStorage.setItem(LS_NOTEPAD, e.target.value);
    });

    const listpad = document.getElementById('listpad');
    const listmap = { u: 'zoom', i: 'rotate', p: 'snapshot', o: 'centralize', k: 'swingthru', l: 'level' };
    let curlist;

    const config = document.getElementById('config');
    for (const cdata of CONFIG) {
        const btn = document.createElement('button');
        btn.textContent = cdata.name;
        btn.classList.add('toggle');
        btn.classList.toggle('activated', conf[cdata.name]);
        btn.addEventListener('click', () => {
            conf[cdata.name] = !conf[cdata.name];
            localStorage.setItem(LS_CONFIG + cdata.name, conf[cdata.name]);
            btn.classList.toggle('activated', conf[cdata.name]);
            cdata.onchange();
        });
        config.appendChild(btn);
    }

    const actions = document.getElementById('actions');
    for (const adata of ACTIONS) {
        const btn = document.createElement('button');
        btn.textContent = adata.name;
        btn.addEventListener('click', adata.onactivate);
        actions.appendChild(btn);
    }

    // ok this stuff *definitely* goes somewhere else
    let keymap = {};
    document.addEventListener('keydown', e => {
        if (conf.hotkeys && keymap[e.key]) {
            e.stopImmediatePropagation();
            for (const elt of Array.from(document.getElementsByClassName('hkpop'))) {
                elt.parentNode.removeChild(elt);
            }
            if (keymap[e.key].tagName === 'INPUT') keymap[e.key].focus();
            else keymap[e.key].click();
            keymap = {};
        } else if (conf.hotkeys && e.key === 'f') {
            e.stopImmediatePropagation();
            const shuf = shuffle(keylist);
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
        } else if (e.key === 'n') {
            notepad.classList.toggle('hidden');
        } else if (listmap[e.key]) {
            if (curlist === e.key) {
                listpad.classList.toggle('hidden');
            } else {
                curlist = e.key;
                listpad.classList.remove('hidden');
                listpad.value = listData[e.key === 'l' ? 'c2' : listmap[e.key]]; // TODO configurable level
            }
        }
    });
});
