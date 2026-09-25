const VID = 0x1532;
const PID = 0x00b8;
const REPORT_LENGTH = 91;
const TX_CONFIG = 0x1f;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (id) => document.getElementById(id);
$('bridge-connect').hidden = !['localhost', '127.0.0.1'].includes(location.hostname);
const controls = ['refresh', 'reset', 'poll-input', 'idle-input'];
let codec;
let device;
let bridge;
let busy = false;
let validated = false;
let stageRaw;
let thresholdRaw;

function connected() { return Boolean(device?.opened || bridge?.readyState === WebSocket.OPEN); }

function bridgeRequest(operation) {
  return new Promise((resolve, reject) => {
    if (bridge?.readyState !== WebSocket.OPEN) { reject(new Error('本地调试桥未连接')); return; }
    const onMessage = (event) => {
      bridge.removeEventListener('message', onMessage);
      try {
        const reply = JSON.parse(event.data);
        if (reply.ok) resolve(reply);
        else reject(new Error(reply.error || '调试桥返回错误'));
      } catch (error) { reject(error); }
    };
    bridge.addEventListener('message', onMessage, { once: true });
    bridge.send(JSON.stringify(operation));
  });
}

function fromHex(hex) {
  if (typeof hex !== 'string' || hex.length % 2) throw new Error('调试桥报文格式错误');
  return Uint8Array.from(hex.match(/../g) || [], (pair) => parseInt(pair, 16));
}

function log(message) {
  const line = `${new Date().toLocaleTimeString()}  ${message}`;
  const element = $('log');
  element.textContent = element.textContent === '等待连接。' ? line : `${line}\n${element.textContent}`;
}

function status(message, error = false) {
  $('connection-status').textContent = message;
  $('connection-status').classList.toggle('error', error);
  log(message);
}

function updateControls() {
  $('connect').disabled = busy || !codec;
  $('bridge-connect').disabled = busy || !codec;
  $('refresh').disabled = busy || !connected();
  for (const id of controls.slice(1)) $(id).disabled = busy || !connected() || !validated;
  for (const form of ['poll-form', 'idle-form']) {
    $(form).querySelector('button').disabled = busy || !connected() || !validated;
  }
  for (const element of $('stages-form').querySelectorAll('input, select, button')) {
    element.disabled = busy || !connected() || !validated || !stageRaw;
  }
  for (const element of $('threshold-form').querySelectorAll('input, button')) {
    element.disabled = busy || !connected() || thresholdRaw === undefined;
  }
}

async function run(label, action) {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    await action();
  } catch (error) {
    status(`${label}失败：${error.message || error}`, true);
  } finally {
    busy = false;
    updateControls();
  }
}

async function loadCodec() {
  const response = await fetch(new URL('./codec.wasm', import.meta.url));
  if (!response.ok) throw new Error(`WASM 下载失败：HTTP ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  const wasm = instance.exports;
  for (const name of ['memory', 'request_ptr', 'response_ptr', 'prepare_request', 'seal_request', 'inspect_response']) {
    if (!wasm[name]) throw new Error(`WASM 缺少导出：${name}`);
  }
  return wasm;
}

function copyResponse(view) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const target = new Uint8Array(codec.memory.buffer, codec.response_ptr(), REPORT_LENGTH);
  if (bytes.length === 90) {
    target[0] = 0;
    target.set(bytes, 1);
  } else if (bytes.length === REPORT_LENGTH && bytes[0] === 0) {
    target.set(bytes);
  } else {
    throw new Error(`Feature Report 长度异常：${bytes.length}`);
  }
}

async function transact(commandClass, commandId, data, tx = TX_CONFIG) {
  if (!connected()) throw new Error('设备未连接');
  if (codec.prepare_request(commandClass, commandId, tx, data.length) !== 0) throw new Error('报文参数超出范围');
  const ptr = codec.request_ptr();
  new Uint8Array(codec.memory.buffer, ptr + 9, data.length).set(data);
  codec.seal_request();
  const frame = new Uint8Array(codec.memory.buffer, ptr, REPORT_LENGTH).slice();
  if (bridge?.readyState === WebSocket.OPEN) {
    const reply = await bridgeRequest({ op: 'exchange', report: Array.from(frame, (byte) => byte.toString(16).padStart(2, '0')).join('') });
    const bytes = fromHex(reply.report);
    copyResponse(new DataView(bytes.buffer));
    const result = codec.inspect_response(tx, commandClass, commandId);
    if (result === 4) throw new Error('设备返回 0x04（配置事务超时）；鼠标输入可能仍正常');
    if (result !== 2) throw new Error(`调试桥响应未通过校验：${result}`);
    return new Uint8Array(codec.memory.buffer, codec.response_ptr() + 9, 80).slice();
  }
  try {
    await device.sendFeatureReport(0, frame.slice(1));
  } catch (error) {
    const mouseCollection = device.collections.some((item) => item.usagePage === 1 && item.usage === 2);
    const hint = mouseCollection
      ? '该接收器的配置 Feature Report 位于 Mouse collection，浏览器可能按受保护鼠标报告拦截；请使用本地调试桥。'
      : '浏览器拒绝发送 Feature Report。';
    throw new Error(`${hint} ${error.message || error}`);
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(50);
    const response = await device.receiveFeatureReport(0);
    copyResponse(response);
    const result = codec.inspect_response(tx, commandClass, commandId);
    if (result === -3 || result === 1) continue; // Old reply or busy: do not send again.
    if (result === -2) throw new Error('响应 XOR 校验失败');
    if (result < 0) throw new Error(`响应格式错误：${result}`);
    if (result === 4) throw new Error('设备返回 0x04（配置事务超时）；鼠标输入可能仍正常');
    if (result !== 2) throw new Error(`设备状态 0x${result.toString(16).padStart(2, '0')}`);
    return new Uint8Array(codec.memory.buffer, codec.response_ptr() + 9, 80).slice();
  }
  throw new Error('等待设备最终响应超时');
}

function decodePoll(bytes) {
  return ({ 1: 1000, 2: 500, 8: 125 })[bytes[0]] ?? null;
}

function decodeDpi(bytes) {
  return [(bytes[1] << 8) | bytes[2], (bytes[3] << 8) | bytes[4]];
}

function decodeStages(bytes) {
  const active = bytes[1], count = bytes[2];
  if (count > 5) throw new Error(`DPI 档位数量异常：${count}`);
  const stages = [];
  for (let index = 0; index < count; index++) {
    const offset = 3 + index * 7;
    stages.push({ number: bytes[offset], x: (bytes[offset + 1] << 8) | bytes[offset + 2], y: (bytes[offset + 3] << 8) | bytes[offset + 4] });
  }
  return { active, stages };
}

async function readPoll() {
  const bytes = await transact(0, 0x85, Uint8Array.of(0));
  const value = decodePoll(bytes);
  $('current-poll').textContent = value ? `${value} Hz` : `0x${bytes[0].toString(16)}`;
  if (value) $('poll-input').value = String(value);
  log(`轮询率：${$('current-poll').textContent}`);
  return value;
}

async function readDpi() {
  const [x, y] = decodeDpi(await transact(4, 0x85, Uint8Array.of(0)));
  $('current-dpi').textContent = x === y ? String(x) : `${x} / ${y}`;
  log(`DPI：X=${x}, Y=${y}`);
  return [x, y];
}

async function readStages() {
  const request = new Uint8Array(0x26);
  request[0] = 1;
  const response = await transact(4, 0x86, request);
  const { active, stages } = decodeStages(response);
  stageRaw = response.slice(0, 38);
  $('active-stage').textContent = `${active} / ${stages.length}`;
  $('stages').replaceChildren(...stages.map((stage) => {
    const element = document.createElement('span');
    element.textContent = `${stage.number}: ${stage.x === stage.y ? stage.x : `${stage.x}/${stage.y}`}`;
    if (stage.number === active) element.className = 'active';
    return element;
  }));
  const rows = stages.map((stage, index) => {
    const label = document.createElement('label');
    label.textContent = `档位 ${stage.number} · DPI`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '100';
    input.max = '30000';
    input.step = '50';
    input.required = true;
    input.dataset.stage = String(index);
    input.value = String(stage.x);
    label.append(input);
    return label;
  });
  $('stage-rows').replaceChildren(...rows);
  $('stage-active').replaceChildren(...stages.map((stage) => new Option(`档位 ${stage.number}`, String(stage.number))));
  $('stage-active').value = String(active);
  log(`DPI 档位：${stages.map((stage) => stage.x).join(', ')}；当前 ${active}`);
  return stageRaw;
}

async function readIdle() {
  const bytes = await transact(7, 0x83, Uint8Array.of(0, 0));
  const seconds = (bytes[0] << 8) | bytes[1];
  $('current-idle').textContent = String(seconds);
  if (seconds >= 60 && seconds <= 900) $('idle-input').value = String(seconds);
  log(`休眠时间：${seconds} 秒`);
  return seconds;
}

async function readBattery() {
  const bytes = await transact(7, 0x80, Uint8Array.of(0, 0));
  const percent = Math.round(bytes[1] * 100 / 255);
  $('battery-level').textContent = `${percent}%`;
  log(`电量：${percent}%（原始值 ${bytes[1]}）`);
}

async function readCharging() {
  const bytes = await transact(7, 0x84, Uint8Array.of(0, 0));
  $('charging-status').textContent = bytes[1] ? '充电中' : '未充电';
  log(`充电状态：${$('charging-status').textContent}`);
}

async function readThreshold() {
  const bytes = await transact(7, 0x81, Uint8Array.of(0));
  thresholdRaw = bytes[0];
  const percent = Math.round(thresholdRaw * 100 / 255);
  $('current-threshold').textContent = `${percent}%`;
  $('threshold-input').value = String(percent);
  log(`低电量提醒：${percent}%（原始值 ${thresholdRaw}）`);
  return thresholdRaw;
}

async function refresh() {
  stageRaw = undefined;
  thresholdRaw = undefined;
  let successes = 0;
  let firstError;
  for (const [name, reader] of [['轮询率', readPoll], ['DPI', readDpi], ['DPI 档位', readStages], ['休眠时间', readIdle], ['电量', readBattery], ['充电状态', readCharging], ['低电量阈值', readThreshold]]) {
    try {
      await reader();
      successes++;
    } catch (error) {
      firstError ??= error.message || String(error);
      log(`${name}读取失败：${error.message || error}`);
      if (String(error.message || error).includes('Feature Report')) break;
    }
  }
  validated = successes >= 2;
  const failure = bridge?.readyState === WebSocket.OPEN
    ? '未能读取配置；接收器的配置事务可能超时。鼠标移动正常也可能发生此情况。'
    : `未能读取配置：${firstError || '浏览器无法访问该接收器的配置报告'}`;
  status(successes ? `已读取 ${successes}/7 项配置${validated ? '' : '；写入功能暂不可用'}` : failure, successes === 0);
}

$('connect').addEventListener('click', () => run('连接', async () => {
  if (!navigator.hid) throw new Error(`当前页面没有 WebHID（安全上下文：${window.isSecureContext ? '是' : '否'}）；请使用桌面版 Chrome 或 Edge，通过 HTTPS 或本机 127.0.0.1 访问`);
  const chosen = await navigator.hid.requestDevice({ filters: [{ vendorId: VID, productId: PID }] });
  if (!chosen.length) { status('未选择设备；请在浏览器设备选择框中确认，或检查接收器是否列出'); return; }
  if (device?.opened) await device.close();
  if (bridge?.readyState === WebSocket.OPEN) bridge.close();
  bridge = undefined;
  sessionStorage.removeItem('localBridge');
  device = chosen[0];
  validated = false;
  const collections = device.collections.map((item) => `${item.usagePage.toString(16)}:${item.usage.toString(16)}`).join(', ') || '未声明';
  log(`已选择 HID 设备；collections: ${collections}`);
  if (device.collections.length && device.collections.every((item) => item.usagePage === 1 && item.usage === 2)) {
    throw new Error('浏览器只暴露 Mouse (01:02) collection；该接收器的配置 Feature Report 位于受保护的鼠标 collection 内。请使用本地调试桥。');
  }
  try {
    await device.open();
  } catch (error) {
    throw new Error(`已授权 ${device.productName}，但 Chrome 无法打开其 HID 接口：${error.message || error}`);
  }
  $('connection-detail').textContent = `${device.productName} · VID ${VID.toString(16)} / PID ${PID.toString(16)}`;
  log(`已打开 HID 接口；collections: ${collections}`);
  await refresh();
}));

async function connectBridge() {
  if (device?.opened) await device.close();
  device = undefined;
  if (bridge?.readyState === WebSocket.OPEN) bridge.close();
  const socket = new WebSocket('ws://127.0.0.1:8766');
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('无法连接 ws://127.0.0.1:8766；请先启动 scripts/bridge.py')), { once: true });
  });
  bridge = socket;
  const reply = await bridgeRequest({ op: 'open' });
  validated = false;
  $('connection-detail').textContent = `${reply.product} · 本地 hidapi 调试桥 · 接口 ${reply.interface}`;
  bridge.addEventListener('close', () => {
    if (bridge !== socket) return;
    bridge = undefined;
    validated = false;
    updateControls();
    status('本地调试桥已断开');
  });
  await refresh();
  sessionStorage.setItem('localBridge', '1');
}

$('bridge-connect').addEventListener('click', () => run('连接本地调试桥', connectBridge));

$('refresh').addEventListener('click', () => run('读取', refresh));

$('stages-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('写入 DPI 档位', async () => {
    if (!stageRaw) throw new Error('请先读取档位配置');
    const expected = stageRaw.slice();
    const active = Number($('stage-active').value);
    if (!Number.isInteger(active) || active < 1 || active > expected[2]) throw new Error('当前档位无效');
    expected[1] = active;
    for (const input of $('stage-rows').querySelectorAll('input')) {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 100 || value > 30000) throw new Error('每档 DPI 必须是 100–30000 的整数');
      const offset = 3 + Number(input.dataset.stage) * 7;
      const oldX = (expected[offset + 1] << 8) | expected[offset + 2];
      const oldY = (expected[offset + 3] << 8) | expected[offset + 4];
      const extra = (expected[offset + 5] << 8) | expected[offset + 6];
      expected.set([value >> 8, value & 255, value >> 8, value & 255], offset + 1);
      if (oldX === oldY && extra === oldX) expected.set([value >> 8, value & 255], offset + 5);
    }
    await transact(4, 0x06, expected);
    const actual = await readStages();
    if (!actual.every((byte, index) => byte === expected[index])) throw new Error('档位读回与请求不一致，请检查设备日志');
    await readDpi();
    status(`DPI 档位已写入并读回；当前档位 ${active}`);
  });
});

$('poll-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('写入轮询率', async () => {
    const desired = Number($('poll-input').value);
    const encoded = ({ 1000: 1, 500: 2, 125: 8 })[desired];
    if (!encoded) throw new Error('轮询率只能是 125、500 或 1000 Hz');
    await transact(0, 0x05, Uint8Array.of(encoded));
    const actual = await readPoll();
    if (actual !== desired) throw new Error(`读回为 ${actual ?? '未知'} Hz，与请求的 ${desired} Hz 不符`);
    status(`轮询率已写入并读回：${actual} Hz`);
  });
});

$('idle-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('写入休眠时间', async () => {
    const desired = Number($('idle-input').value);
    if (!Number.isInteger(desired) || desired < 60 || desired > 900) throw new Error('休眠时间必须是 60–900 秒的整数');
    await transact(7, 0x03, Uint8Array.of(desired >> 8, desired & 255));
    const actual = await readIdle();
    if (actual !== desired) throw new Error(`读回为 ${actual} 秒，与请求的 ${desired} 秒不符`);
    status(`休眠时间已写入并读回：${actual} 秒`);
  });
});

$('threshold-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('写入低电量阈值', async () => {
    const percent = Number($('threshold-input').value);
    if (!Number.isInteger(percent) || percent < 5 || percent > 30) throw new Error('阈值必须是 5–30% 的整数');
    const encoded = Math.round(percent * 255 / 100);
    await transact(7, 0x01, Uint8Array.of(encoded));
    const actual = await readThreshold();
    if (actual !== encoded) throw new Error(`读回原始值 ${actual}，与请求的 ${encoded} 不符`);
    status(`低电量阈值已写入并读回：${percent}%`);
  });
});

$('reset').addEventListener('click', () => run('恢复出厂', async () => {
  if (window.prompt('恢复出厂设置会覆盖鼠标配置。输入 RESET 确认：') !== 'RESET') {
    status('已取消恢复出厂设置');
    return;
  }
  await transact(0, 0x0b, Uint8Array.of(1), 0);
  status('设备已确认恢复默认命令；正在重新读取配置');
  await sleep(350);
  await refresh();
}));

$('clear-log').addEventListener('click', () => { $('log').textContent = '日志已清空。'; });
if (navigator.hid) navigator.hid.addEventListener('disconnect', (event) => {
  if (device === event.device) {
    device = undefined;
    validated = false;
    updateControls();
    status('设备已断开');
  }
});

try {
  codec = await loadCodec();
  status(navigator.hid ? 'WASM 已就绪；请选择接收器' : 'WASM 已就绪，但浏览器没有 WebHID', !navigator.hid);
  if (!$('bridge-connect').hidden && sessionStorage.getItem('localBridge') === '1') {
    await run('自动连接本地调试桥', connectBridge);
  }
} catch (error) {
  status(`WASM 初始化失败：${error.message || error}`, true);
}
updateControls();
