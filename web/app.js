const VID = 0x1532;
const PID = 0x00b8;
const REPORT_LENGTH = 91;
const TX_CONFIG = 0x1f;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (id) => document.getElementById(id);
const controls = ['refresh', 'reset', 'poll-input', 'idle-input'];
const messages = {
  lead: ['A compact Viper V3 HyperSpeed configurator. The browser builds reports; a local HID bridge sends them to the receiver.', '轻量的 Viper V3 HyperSpeed 配置页。浏览器生成报文，由本机 HID 桥发给接收器。'],
  connectionTitle: ['Connect the mouse receiver', '连接鼠标接收器'],
  connectionDetail: ["Download the source and start the local HID bridge first. The receiver's configuration reports are inside a protected Mouse collection, so Chrome/Edge cannot use direct WebHID.", '先下载源码并启动本地 HID 桥，再点击连接。原厂接收器把配置报告放在受保护的 Mouse collection 内，Chrome/Edge WebHID 无法直接访问。'],
  connectBridge: ['Connect local HID bridge', '连接本地 HID 桥'],
  webhidUnavailable: ['Direct WebHID unavailable', 'WebHID 直连不可用'],
  webhidReason: ["The receiver's configuration Feature Report is inside a protected Mouse collection", '原厂接收器的配置 Feature Report 位于受保护的 Mouse collection'],
  readSettings: ['Read settings', '读取配置'],
  loading: ['Loading WASM…', '正在加载 WASM…'],
  currentSettings: ['Current settings', '当前配置'],
  currentDpi: ['Current DPI', '当前 DPI'],
  pollingRate: ['Polling rate', '轮询率'],
  stockReceiver: ['Stock 1K receiver', '原厂 1K 接收器'],
  idleTime: ['Idle time', '休眠时间'],
  seconds: ['seconds', '秒'],
  dpiExplanation: ['The active onboard stage controls current DPI. A temporary DPI value is lost when that stage is reapplied; edit the onboard stages below.', '当前 DPI 由活动档位决定。直接写即时 DPI 会在档位重新应用时恢复；请在下方修改板载档位。'],
  onboardStages: ['Onboard stages', '板载档位'],
  readAfterConnect: ['Read after connecting', '连接后读取'],
  stagesExplanation: ["Set each stage's DPI (X and Y together) and select the active stage. Changes are written onboard and read back for verification.", '逐档修改 DPI（同步设置 X/Y），并选择当前档位。改动会写入板载配置，随后完整读回核对。'],
  activeStage: ['Active stage', '当前档位'],
  writeStages: ['Write stages', '写入档位'],
  receiverOnly: ['This page targets the stock VID 1532 / PID 00B8 receiver only.', '此页仅针对 VID 1532 / PID 00B8 的原厂接收器。'],
  reportFrequency: ['Report frequency', '报告频率'],
  writeRate: ['Write rate', '写入频率'],
  idleSeconds: ['Idle time (seconds)', '休眠时间（秒）'],
  writeTime: ['Write time', '写入时间'],
  powerStatus: ['Power status', '电源状态'],
  battery: ['Battery', '电量'],
  charging: ['Charging', '充电状态'],
  lowBattery: ['Low battery alert', '低电量提醒'],
  thresholdLabel: ['Low battery alert threshold (5–30%)', '低电量提醒阈值（5–30%）'],
  writeThreshold: ['Write threshold', '写入阈值'],
  factoryReset: ['Factory reset', '恢复出厂配置'],
  resetExplanation: ['Resets mouse settings. You must type RESET to confirm. This does not change the macOS scroll direction setting.', '会重置鼠标配置。点击后还需要输入 RESET 确认。不会更改 macOS 的滚动方向设置。'],
  resetButton: ['Reset to defaults', '恢复出厂设置'],
  deviceLog: ['Device log', '设备日志'],
  clear: ['Clear', '清空'],
  waiting: ['Waiting to connect.', '等待连接。'],
  footer: ['Local HID bridge + Rust WASM · No account ·', '本地 HID 桥 + Rust WASM · 无账户 ·'],
  protocolReference: ['Protocol reference', '协议参考'],
};
let language = localStorage.getItem('language') || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
function tr(en, zh) { return language === 'zh' ? zh : en; }
let bridgeInfo;
function translatePage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  for (const [attribute, target] of [['data-i18n', 'textContent'], ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'ariaLabel']]) {
    for (const element of document.querySelectorAll(`[${attribute}]`)) {
      const pair = messages[element.getAttribute(attribute)];
      if (!pair) throw new Error(`Missing translation: ${element.getAttribute(attribute)}`);
      element[target] = pair[language === 'zh' ? 1 : 0];
    }
  }
  for (const code of ['en', 'zh']) $('lang-' + code).setAttribute('aria-pressed', String(language === code));
  if (bridgeInfo) $('connection-detail').textContent = tr(`${bridgeInfo.product} · local hidapi bridge · interface ${bridgeInfo.interface}`, `${bridgeInfo.product} · 本地 hidapi 调试桥 · 接口 ${bridgeInfo.interface}`);
}
translatePage();
let codec;
let device;
let bridge;
let busy = false;
let validated = false;
let stageRaw;
let thresholdRaw;

function connected() { return Boolean(device?.opened || bridge?.readyState === WebSocket.OPEN); }

function bridgeError(message) {
  if (language === 'zh') return message;
  if (message.startsWith('找不到可打开的 1532:00B8 接口')) return 'No usable 1532:00B8 HID interface found';
  if (message.startsWith('报文必须为 91 字节')) return 'Report must be 91 bytes with Report ID 0';
  if (message.startsWith('Feature Report 写入长度异常')) return message.replace('写入长度异常', 'write length mismatch');
  if (message.startsWith('设备响应超时；最后报文：')) return message.replace('设备响应超时；最后报文：', 'Device reply timed out; last report: ');
  return message;
}

function bridgeRequest(operation) {
  return new Promise((resolve, reject) => {
    if (bridge?.readyState !== WebSocket.OPEN) { reject(new Error(tr('Local HID bridge is not connected', '本地调试桥未连接'))); return; }
    const onMessage = (event) => {
      bridge.removeEventListener('message', onMessage);
      try {
        const reply = JSON.parse(event.data);
        if (reply.ok) resolve(reply);
        else reject(new Error(reply.error ? bridgeError(reply.error) : tr('Bridge returned an error', '调试桥返回错误')));
      } catch (error) { reject(error); }
    };
    bridge.addEventListener('message', onMessage, { once: true });
    bridge.send(JSON.stringify(operation));
  });
}

function fromHex(hex) {
  if (typeof hex !== 'string' || hex.length % 2) throw new Error(tr('Invalid bridge report format', '调试桥报文格式错误'));
  return Uint8Array.from(hex.match(/../g) || [], (pair) => parseInt(pair, 16));
}

function log(message) {
  const line = `${new Date().toLocaleTimeString()}  ${message}`;
  const element = $('log');
  element.textContent = element.textContent === messages.waiting[0] || element.textContent === messages.waiting[1] ? line : `${line}\n${element.textContent}`;
}

function status(message, error = false) {
  $('connection-status').textContent = message;
  $('connection-status').classList.toggle('error', error);
  log(message);
}

function updateControls() {
  $('connect').disabled = true;
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
    status(tr(`${label} failed: ${error.message || error}`, `${label}失败：${error.message || error}`), true);
  } finally {
    busy = false;
    updateControls();
  }
}

async function loadCodec() {
  const response = await fetch(new URL('./codec.wasm', import.meta.url));
  if (!response.ok) throw new Error(tr(`WASM download failed: HTTP ${response.status}`, `WASM 下载失败：HTTP ${response.status}`));
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  const wasm = instance.exports;
  for (const name of ['memory', 'request_ptr', 'response_ptr', 'prepare_request', 'seal_request', 'inspect_response']) {
    if (!wasm[name]) throw new Error(tr(`Missing WASM export: ${name}`, `WASM 缺少导出：${name}`));
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
    throw new Error(tr(`Unexpected Feature Report length: ${bytes.length}`, `Feature Report 长度异常：${bytes.length}`));
  }
}

async function transact(commandClass, commandId, data, tx = TX_CONFIG) {
  if (!connected()) throw new Error(tr('Device is not connected', '设备未连接'));
  if (codec.prepare_request(commandClass, commandId, tx, data.length) !== 0) throw new Error(tr('Report arguments are out of range', '报文参数超出范围'));
  const ptr = codec.request_ptr();
  new Uint8Array(codec.memory.buffer, ptr + 9, data.length).set(data);
  codec.seal_request();
  const frame = new Uint8Array(codec.memory.buffer, ptr, REPORT_LENGTH).slice();
  if (bridge?.readyState === WebSocket.OPEN) {
    const reply = await bridgeRequest({ op: 'exchange', report: Array.from(frame, (byte) => byte.toString(16).padStart(2, '0')).join('') });
    const bytes = fromHex(reply.report);
    copyResponse(new DataView(bytes.buffer));
    const result = codec.inspect_response(tx, commandClass, commandId);
    if (result === 4) throw new Error(tr('Device returned 0x04 (configuration transaction timed out); mouse movement may still work', '设备返回 0x04（配置事务超时）；鼠标输入可能仍正常'));
    if (result !== 2) throw new Error(tr(`Bridge reply failed validation: ${result}`, `调试桥响应未通过校验：${result}`));
    return new Uint8Array(codec.memory.buffer, codec.response_ptr() + 9, 80).slice();
  }
  try {
    await device.sendFeatureReport(0, frame.slice(1));
  } catch (error) {
    const mouseCollection = device.collections.some((item) => item.usagePage === 1 && item.usage === 2);
    const hint = mouseCollection
      ? tr('The receiver configuration report is inside a protected Mouse collection; use the local HID bridge.', '该接收器的配置 Feature Report 位于 Mouse collection，浏览器可能按受保护鼠标报告拦截；请使用本地调试桥。')
      : tr('The browser refused to send the Feature Report.', '浏览器拒绝发送 Feature Report。');
    throw new Error(`${hint} ${error.message || error}`);
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(50);
    const response = await device.receiveFeatureReport(0);
    copyResponse(response);
    const result = codec.inspect_response(tx, commandClass, commandId);
    if (result === -3 || result === 1) continue; // Old reply or busy: do not send again.
    if (result === -2) throw new Error(tr('Response XOR checksum failed', '响应 XOR 校验失败'));
    if (result < 0) throw new Error(tr(`Invalid response format: ${result}`, `响应格式错误：${result}`));
    if (result === 4) throw new Error(tr('Device returned 0x04 (configuration transaction timed out); mouse movement may still work', '设备返回 0x04（配置事务超时）；鼠标输入可能仍正常'));
    if (result !== 2) throw new Error(tr(`Device status 0x${result.toString(16).padStart(2, '0')}`, `设备状态 0x${result.toString(16).padStart(2, '0')}`));
    return new Uint8Array(codec.memory.buffer, codec.response_ptr() + 9, 80).slice();
  }
  throw new Error(tr('Timed out waiting for the final device reply', '等待设备最终响应超时'));
}

function decodePoll(bytes) {
  return ({ 1: 1000, 2: 500, 8: 125 })[bytes[0]] ?? null;
}

function decodeDpi(bytes) {
  return [(bytes[1] << 8) | bytes[2], (bytes[3] << 8) | bytes[4]];
}

function decodeStages(bytes) {
  const active = bytes[1], count = bytes[2];
  if (count > 5) throw new Error(tr(`Unexpected DPI stage count: ${count}`, `DPI 档位数量异常：${count}`));
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
  log(tr(`Polling rate: ${$('current-poll').textContent}`, `轮询率：${$('current-poll').textContent}`));
  return value;
}

async function readDpi() {
  const [x, y] = decodeDpi(await transact(4, 0x85, Uint8Array.of(0)));
  $('current-dpi').textContent = x === y ? String(x) : `${x} / ${y}`;
  log(`DPI: X=${x}, Y=${y}`);
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
    label.textContent = tr(`Stage ${stage.number} · DPI`, `档位 ${stage.number} · DPI`);
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
  $('stage-active').replaceChildren(...stages.map((stage) => new Option(tr(`Stage ${stage.number}`, `档位 ${stage.number}`), String(stage.number))));
  $('stage-active').value = String(active);
  log(tr(`DPI stages: ${stages.map((stage) => stage.x).join(', ')}; active ${active}`, `DPI 档位：${stages.map((stage) => stage.x).join(', ')}；当前 ${active}`));
  return stageRaw;
}

async function readIdle() {
  const bytes = await transact(7, 0x83, Uint8Array.of(0, 0));
  const seconds = (bytes[0] << 8) | bytes[1];
  $('current-idle').textContent = String(seconds);
  if (seconds >= 60 && seconds <= 900) $('idle-input').value = String(seconds);
  log(tr(`Idle time: ${seconds} seconds`, `休眠时间：${seconds} 秒`));
  return seconds;
}

async function readBattery() {
  const bytes = await transact(7, 0x80, Uint8Array.of(0, 0));
  const percent = Math.round(bytes[1] * 100 / 255);
  $('battery-level').textContent = `${percent}%`;
  log(tr(`Battery: ${percent}% (raw ${bytes[1]})`, `电量：${percent}%（原始值 ${bytes[1]}）`));
}

async function readCharging() {
  const bytes = await transact(7, 0x84, Uint8Array.of(0, 0));
  $('charging-status').textContent = bytes[1] ? tr('Charging', '充电中') : tr('Not charging', '未充电');
  log(tr(`Charging status: ${$('charging-status').textContent}`, `充电状态：${$('charging-status').textContent}`));
}

async function readThreshold() {
  const bytes = await transact(7, 0x81, Uint8Array.of(0));
  thresholdRaw = bytes[0];
  const percent = Math.round(thresholdRaw * 100 / 255);
  $('current-threshold').textContent = `${percent}%`;
  $('threshold-input').value = String(percent);
  log(tr(`Low battery alert: ${percent}% (raw ${thresholdRaw})`, `低电量提醒：${percent}%（原始值 ${thresholdRaw}）`));
  return thresholdRaw;
}

async function refresh() {
  stageRaw = undefined;
  thresholdRaw = undefined;
  let successes = 0;
  let firstError;
  for (const [name, reader] of [[tr('Polling rate', '轮询率'), readPoll], ['DPI', readDpi], [tr('DPI stages', 'DPI 档位'), readStages], [tr('Idle time', '休眠时间'), readIdle], [tr('Battery', '电量'), readBattery], [tr('Charging status', '充电状态'), readCharging], [tr('Low battery threshold', '低电量阈值'), readThreshold]]) {
    try {
      await reader();
      successes++;
    } catch (error) {
      firstError ??= error.message || String(error);
      log(tr(`${name} read failed: ${error.message || error}`, `${name}读取失败：${error.message || error}`));
      if (String(error.message || error).includes('Feature Report')) break;
    }
  }
  validated = successes >= 2;
  const failure = bridge?.readyState === WebSocket.OPEN
    ? tr('Could not read settings; the receiver transaction may have timed out even if mouse movement still works.', '未能读取配置；接收器的配置事务可能超时。鼠标移动正常也可能发生此情况。')
    : tr(`Could not read settings: ${firstError || 'the browser cannot access receiver configuration reports'}`, `未能读取配置：${firstError || '浏览器无法访问该接收器的配置报告'}`);
  status(successes ? tr(`Read ${successes}/7 settings${validated ? '' : '; writing is temporarily unavailable'}`, `已读取 ${successes}/7 项配置${validated ? '' : '；写入功能暂不可用'}`) : failure, successes === 0);
}

$('connect').addEventListener('click', () => run('连接', async () => {
  if (!navigator.hid) throw new Error(`当前页面没有 WebHID（安全上下文：${window.isSecureContext ? '是' : '否'}）；请使用桌面版 Chrome 或 Edge，通过 HTTPS 或本机 127.0.0.1 访问`);
  const chosen = await navigator.hid.requestDevice({ filters: [{ vendorId: VID, productId: PID }] });
  const granted = (await navigator.hid.getDevices()).filter((item) => item.vendorId === VID && item.productId === PID);
  if (!chosen.length && !granted.length) { status('未选择设备；请在浏览器设备选择框中确认，或检查接收器是否列出'); return; }
  if (device?.opened) await device.close();
  if (bridge?.readyState === WebSocket.OPEN) bridge.close();
  bridge = undefined;
  sessionStorage.removeItem('localBridge');
  validated = false;
  const candidates = [...chosen, ...granted];
  log(`浏览器选择 ${chosen.length} 个、已授权 ${granted.length} 个同型号 HID 对象`);
  let lastError;
  for (const candidate of candidates) {
    device = candidate;
    const collections = candidate.collections.map((item) => `${item.usagePage.toString(16)}:${item.usage.toString(16)}`).join(', ') || '未声明';
    log(`尝试 HID 接口；collections: ${collections}`);
    try {
      if (!candidate.opened) await candidate.open();
      await transact(0, 0x85, Uint8Array.of(0));
      $('connection-detail').textContent = `${candidate.productName} · VID ${VID.toString(16)} / PID ${PID.toString(16)} · ${collections}`;
      log(`已验证配置 Feature Report 接口：${collections}`);
      await refresh();
      return;
    } catch (error) {
      lastError = error;
      log(`接口不可用于配置：${error.message || error}`);
      if (candidate.opened) await candidate.close();
    }
  }
  device = undefined;
  throw new Error(`已尝试 ${candidates.length} 个授权对象，均无法读写配置 Feature Report。最后错误：${lastError?.message || lastError || '未知'}`);
}));

async function connectBridge() {
  if (device?.opened) await device.close();
  device = undefined;
  if (bridge?.readyState === WebSocket.OPEN) bridge.close();
  const socket = new WebSocket('ws://127.0.0.1:8766');
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error(tr('Cannot connect to ws://127.0.0.1:8766; start scripts/bridge.py first', '无法连接 ws://127.0.0.1:8766；请先启动 scripts/bridge.py'))), { once: true });
  });
  bridge = socket;
  let reply;
  try {
    reply = await bridgeRequest({ op: 'open' });
  } catch (error) {
    bridge = undefined;
    bridgeInfo = undefined;
    socket.close();
    throw error;
  }
  bridgeInfo = reply;
  validated = false;
  $('connection-detail').removeAttribute('data-i18n');
  translatePage();
  bridge.addEventListener('close', () => {
    if (bridge !== socket) return;
    bridge = undefined;
    bridgeInfo = undefined;
    validated = false;
    updateControls();
    status(tr('Local HID bridge disconnected', '本地调试桥已断开'));
  });
  await refresh();
  sessionStorage.setItem('localBridge', '1');
}

$('bridge-connect').addEventListener('click', () => run(tr('Connect local HID bridge', '连接本地调试桥'), connectBridge));

$('refresh').addEventListener('click', () => run(tr('Read settings', '读取'), refresh));

$('stages-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(tr('Write DPI stages', '写入 DPI 档位'), async () => {
    if (!stageRaw) throw new Error(tr('Read the stage configuration first', '请先读取档位配置'));
    const expected = stageRaw.slice();
    const active = Number($('stage-active').value);
    if (!Number.isInteger(active) || active < 1 || active > expected[2]) throw new Error(tr('Invalid active stage', '当前档位无效'));
    expected[1] = active;
    for (const input of $('stage-rows').querySelectorAll('input')) {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 100 || value > 30000) throw new Error(tr('Each stage DPI must be an integer from 100 to 30000', '每档 DPI 必须是 100–30000 的整数'));
      const offset = 3 + Number(input.dataset.stage) * 7;
      const oldX = (expected[offset + 1] << 8) | expected[offset + 2];
      const oldY = (expected[offset + 3] << 8) | expected[offset + 4];
      const extra = (expected[offset + 5] << 8) | expected[offset + 6];
      expected.set([value >> 8, value & 255, value >> 8, value & 255], offset + 1);
      if (oldX === oldY && extra === oldX) expected.set([value >> 8, value & 255], offset + 5);
    }
    await transact(4, 0x06, expected);
    const actual = await readStages();
    if (!actual.every((byte, index) => byte === expected[index])) throw new Error(tr('Readback does not match the requested stages; check the device log', '档位读回与请求不一致，请检查设备日志'));
    await readDpi();
    status(tr(`DPI stages written and verified; active stage ${active}`, `DPI 档位已写入并读回；当前档位 ${active}`));
  });
});

$('poll-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(tr('Write polling rate', '写入轮询率'), async () => {
    const desired = Number($('poll-input').value);
    const encoded = ({ 1000: 1, 500: 2, 125: 8 })[desired];
    if (!encoded) throw new Error(tr('Polling rate must be 125, 500, or 1000 Hz', '轮询率只能是 125、500 或 1000 Hz'));
    await transact(0, 0x05, Uint8Array.of(encoded));
    const actual = await readPoll();
    if (actual !== desired) throw new Error(tr(`Readback was ${actual ?? 'unknown'} Hz, expected ${desired} Hz`, `读回为 ${actual ?? '未知'} Hz，与请求的 ${desired} Hz 不符`));
    status(tr(`Polling rate written and verified: ${actual} Hz`, `轮询率已写入并读回：${actual} Hz`));
  });
});

$('idle-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(tr('Write idle time', '写入休眠时间'), async () => {
    const desired = Number($('idle-input').value);
    if (!Number.isInteger(desired) || desired < 60 || desired > 900) throw new Error(tr('Idle time must be an integer from 60 to 900 seconds', '休眠时间必须是 60–900 秒的整数'));
    await transact(7, 0x03, Uint8Array.of(desired >> 8, desired & 255));
    const actual = await readIdle();
    if (actual !== desired) throw new Error(tr(`Readback was ${actual} seconds, expected ${desired}`, `读回为 ${actual} 秒，与请求的 ${desired} 秒不符`));
    status(tr(`Idle time written and verified: ${actual} seconds`, `休眠时间已写入并读回：${actual} 秒`));
  });
});

$('threshold-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(tr('Write low battery threshold', '写入低电量阈值'), async () => {
    const percent = Number($('threshold-input').value);
    if (!Number.isInteger(percent) || percent < 5 || percent > 30) throw new Error(tr('Threshold must be an integer from 5 to 30%', '阈值必须是 5–30% 的整数'));
    const encoded = Math.round(percent * 255 / 100);
    await transact(7, 0x01, Uint8Array.of(encoded));
    const actual = await readThreshold();
    if (actual !== encoded) throw new Error(tr(`Raw readback was ${actual}, expected ${encoded}`, `读回原始值 ${actual}，与请求的 ${encoded} 不符`));
    status(tr(`Low battery threshold written and verified: ${percent}%`, `低电量阈值已写入并读回：${percent}%`));
  });
});

$('reset').addEventListener('click', () => run(tr('Factory reset', '恢复出厂'), async () => {
  if (window.prompt(tr('Factory reset overwrites mouse settings. Type RESET to confirm:', '恢复出厂设置会覆盖鼠标配置。输入 RESET 确认：')) !== 'RESET') {
    status(tr('Factory reset cancelled', '已取消恢复出厂设置'));
    return;
  }
  await transact(0, 0x0b, Uint8Array.of(1), 0);
  status(tr('Device accepted the reset command; reading settings again', '设备已确认恢复默认命令；正在重新读取配置'));
  await sleep(350);
  await refresh();
}));

$('clear-log').addEventListener('click', () => { $('log').textContent = tr('Log cleared.', '日志已清空。'); });
if (navigator.hid) navigator.hid.addEventListener('disconnect', (event) => {
  if (device === event.device) {
    device = undefined;
    validated = false;
    updateControls();
    status(tr('Device disconnected', '设备已断开'));
  }
});

try {
  codec = await loadCodec();
  status(tr('WASM ready; start the local HID bridge and connect', 'WASM 已就绪；请启动本地 HID 桥并连接'));
  if (sessionStorage.getItem('localBridge') === '1') {
    await run(tr('Reconnect local HID bridge', '自动连接本地调试桥'), connectBridge);
  }
} catch (error) {
  status(tr(`WASM initialization failed: ${error.message || error}`, `WASM 初始化失败：${error.message || error}`), true);
}
updateControls();

for (const code of ['en', 'zh']) $('lang-' + code).addEventListener('click', () => {
  if (language === code) return;
  language = code;
  localStorage.setItem('language', code);
  translatePage();
  if (connected() && validated) run(tr('Read settings', '读取配置'), refresh);
  else if (connected()) status(tr('Local HID bridge connected; read settings to enable controls', '本地 HID 桥已连接；读取配置后启用选项'));
  else status(tr('WASM ready; start the local HID bridge and connect', 'WASM 已就绪；请启动本地 HID 桥并连接'));
});
