// Read-only end-to-end check of the WASM codec and local hidapi bridge.
import { readFile } from 'node:fs/promises';

const { instance } = await WebAssembly.instantiate(await readFile(new URL('../dist/codec.wasm', import.meta.url)));
const wasm = instance.exports;
const socket = new WebSocket('ws://127.0.0.1:8766');
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', () => reject(new Error('无法连接本地调试桥')), { once: true });
});

function request(body) {
  return new Promise((resolve, reject) => {
    socket.addEventListener('message', (event) => {
      const reply = JSON.parse(event.data);
      reply.ok ? resolve(reply) : reject(new Error(reply.error));
    }, { once: true });
    socket.send(JSON.stringify(body));
  });
}

async function read(name, commandClass, commandId, data) {
  if (wasm.prepare_request(commandClass, commandId, 0x1f, data.length) !== 0) throw new Error('WASM 拒绝参数');
  new Uint8Array(wasm.memory.buffer, wasm.request_ptr() + 9, data.length).set(data);
  wasm.seal_request();
  const frame = Buffer.from(new Uint8Array(wasm.memory.buffer, wasm.request_ptr(), 91));
  const reply = await request({ op: 'exchange', report: frame.toString('hex') });
  const raw = Buffer.from(reply.report, 'hex');
  if (raw.length !== 91) throw new Error(`${name} 回包长度 ${raw.length}`);
  new Uint8Array(wasm.memory.buffer, wasm.response_ptr(), 91).set(raw);
  const status = wasm.inspect_response(0x1f, commandClass, commandId);
  if (status !== 2) throw new Error(`${name} 状态/校验 ${status}`);
  console.log(`${name}: ${raw.subarray(9, 9 + (name === 'DPI' ? 5 : raw[6])).toString('hex')}`);
}

try {
  const opened = await request({ op: 'open' });
  console.log(`已打开 ${opened.product}，接口 ${opened.interface}`);
  await read('轮询率', 0, 0x85, [0]);
  await read('DPI', 4, 0x85, [0]);
  await read('DPI 档位', 4, 0x86, [1, ...Array(37).fill(0)]);
  await read('休眠时间', 7, 0x83, [0, 0]);
} finally {
  socket.close();
}
