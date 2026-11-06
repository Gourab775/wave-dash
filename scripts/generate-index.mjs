import fs from 'node:fs';

let html = fs.readFileSync('public/wave-dash.html', 'utf8');

// Drop any BOM carried from earlier writes.
html = html.replace(/^\uFEFF/, '');

// Point asset refs at the mirrored public/ copies used by index.html.
html = html.replace(/(src|href)="assets\//g, '$1="public/assets/');

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html bytes:', Buffer.byteLength(html, 'utf8'));
