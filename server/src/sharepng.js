// v22 TIME CARD: PNG encoding of the shared pixel card (sharecard.js draws it).
// No image library: the card is flat pixel art, so a plain zlib-deflated RGB
// PNG is small (about 25 KB at 1200x675) and takes ~30 ms.
import zlib from 'node:zlib';
import './sharecard.js';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng({ w, h, data }) {
  const stride = w * 3 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const o = y * stride; raw[o] = 0;
    for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = o + 1 + x * 3; raw[d] = data[s]; raw[d + 1] = data[s + 1]; raw[d + 2] = data[s + 2]; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

export const cardPng = stats => encodePng(globalThis.ZFCard.render(stats));
export const fmtTime = ms => globalThis.ZFCard.fmtTime(ms);
