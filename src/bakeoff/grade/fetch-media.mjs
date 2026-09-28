/* global console, fetch, Buffer */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const m = JSON.parse(readFileSync('out/proof-media.json','utf8'));
mkdirSync('out/media',{recursive:true});
const names = {};
for (const [k,v] of Object.entries(m)) {
  if (typeof v !== 'string' || !v) { console.log(k,'empty'); continue; }
  try {
    const r = await fetch(v);
    const ct = r.headers.get('content-type')||'';
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = ct.includes('jpeg')?'jpg':ct.includes('png')?'png':ct.includes('webp')?'webp':ct.includes('mp4')?'mp4':ct.includes('mpeg')?'mp3':ct.includes('audio')?'mp3':'bin';
    const f = `${k}.${ext}`;
    writeFileSync('out/media/'+f, buf);
    names[k]=f;
    console.log(k, r.status, ct, buf.length);
  } catch(e){ console.log(k,'ERR',String(e.cause?.code||e.message)); }
}
writeFileSync('out/media/names.json', JSON.stringify(names));
