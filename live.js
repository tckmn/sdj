import { Player } from './player.js';
import { fetchJSON } from './util.js';

window.addEventListener('load', async () => {
    const player = new Player({
        btns: document.getElementById('btns'),
        draw: document.getElementById('draw'),
        metronome: document.getElementById('metronome'),
        msg: document.getElementById('msg'),
        notes: document.getElementById('notes'),
        status: document.getElementById('status'),
    });

    const songData = await fetchJSON('songdata.json');
    for (const k of Object.keys(songData)) songData[k].name = k;

    const tipTimerList = await fetchJSON('snd/tiptimer/list.json');

    const patter = document.getElementById('patter');
    const singer = document.getElementById('singer');

    for (const k of Object.keys(songData).sort()) {
        const btn = document.createElement('button');
        btn.classList.add('hk');
        btn.textContent = k;
        btn.addEventListener('click', () => {
            void player.load(songData[k]);
        });
        (songData[k].flavor === 'patter' ? patter : singer).appendChild(btn);
    }

    if (location.search) {
        const opts = Object.fromEntries(new URLSearchParams('name=' + location.search.slice(1)).entries());
        void player.load(songData[opts.name], opts);
    }
});
