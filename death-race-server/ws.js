// Tiny dependency-free WebSocket server (RFC 6455, text frames only).
'use strict';
const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function accept(req, socket, onConn) {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  socket.setNoDelay(true);
  const ws = { open: true, onmessage: null, onclose: null, ip: req.headers['x-forwarded-for'] || socket.remoteAddress };
  let buf = Buffer.alloc(0);
  ws.send = (str) => {
    if (!ws.open) return;
    const data = Buffer.from(str);
    let head;
    if (data.length < 126) { head = Buffer.from([0x81, data.length]); }
    else if (data.length < 65536) { head = Buffer.from([0x81, 126, data.length >> 8, data.length & 255]); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    if (socket.writableLength > 4e6) return; // slow client: drop frames
    socket.write(Buffer.concat([head, data]));
  };
  ws.close = () => { if (!ws.open) return; ws.open = false; try { socket.end(Buffer.from([0x88, 0])); } catch (e) {} if (ws.onclose) ws.onclose(); };
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 15, masked = buf[1] & 128; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { ws.close(); socket.destroy(); return; }
      const mOff = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      const payload = Buffer.from(buf.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) payload[i] ^= buf[mOff + (i & 3)];
      buf = buf.subarray(off + len);
      if (op === 8) { ws.close(); socket.destroy(); return; }
      if (op === 9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 1 && ws.onmessage) { try { ws.onmessage(payload.toString()); } catch (e) { console.error(e); } }
    }
  });
  const end = () => { if (ws.open) { ws.open = false; if (ws.onclose) ws.onclose(); } };
  socket.on('close', end); socket.on('error', end);
  onConn(ws);
}
module.exports = { accept };
