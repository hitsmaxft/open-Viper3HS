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
  buttonMappings: ['Button mappings', '按键映射'],
  bindingsExplanation: ['Choose an onboard profile or the active RAM mapping, then read a button before editing. The two side buttons, wheel directions, and DPI button are included. Every write is read back.', '选择板载 Profile 或当前 RAM 映射，先读取按键再修改。包含两个侧键、滚轮方向和 DPI 键；写入后会读回核对。'],
  profileLimit: ['Profiles 1–5 have separate firmware mapping tables. Persistence after power loss has not yet been tested on this mouse.', 'Profile 1–5 各有独立的固件映射表；本机尚未验证断电后的保存效果。'],
  wheelDirection: ['Wheel direction', '滚轮方向'],
  wheelShortcutHelp: ["Applies to both wheel inputs in the selected profile's normal layer. Active RAM changes are temporary.", '同时修改所选配置档普通层的两个滚轮输入。当前 RAM 的修改是临时的。'],
  wheelDefault: ['Restore default', '恢复默认'],
  wheelInvert: ['Invert direction', '翻转方向'],
  bindingProfile: ['Profile', '配置档'],
  activeRam: ['Active RAM (temporary)', '当前 RAM（临时）'],
  bindingInput: ['Physical input', '物理输入'],
  bindingLayer: ['Layer', '映射层'],
  normalLayer: ['Normal', '普通'],
  shiftLayer: ['Hypershift', 'Hypershift'],
  readBinding: ['Read binding', '读取映射'],
  bindingAction: ['Action', '动作'],
  profileOverview: ['Profile button map', '配置档按键总览'],
  readAllBindings: ['Read all buttons', '读取全部按键'],
  activateProfile: ['Activate selected profile', '激活所选配置档'],
  activateProfileLimit: ['The separate 05/04 activation command is known from the updater; its effect on this receiver has not been tested.', '更新器中存在独立的 05/04 激活命令；本机尚未验证它在此接收器上的效果。'],
  chooseAction: ['Choose action…', '选择动作…'],
  close: ['Close', '关闭'],
  pickerExplanation: ['Select an action to fill the editor. Saving still requires Write and verify.', '选择动作会填入编辑器；仍需点击「写入并读回」才会保存。'],
  searchActions: ['Search actions or codes', '搜索动作或键码'],
  profileSwitchUnavailable: ["Profile-switch binding (0x07) is documented for other Razer mice but is ignored by this model's firmware.", '文档中的按键切换 Profile（0x07）适用于其他型号；此型号固件会跳过该动作。'],
  bindingRaw: ['Seven-byte mapping (hex)', '七字节映射（十六进制）'],
  bindingRawHelp: ['The action selector fills a starting value. The exact seven bytes above are written. Unsupported firmware categories are read-only.', '动作选项会填入初始值；实际写入上方七字节。固件不支持的类别仅可读取。'],
  writeBinding: ['Write and verify', '写入并读回'],
  restoreBinding: ['Restore previous', '恢复上次映射'],
  factoryReset: ['Factory reset', '恢复出厂配置'],
  resetExplanation: ['Resets mouse settings. You must type RESET to confirm. This does not change the macOS scroll direction setting.', '会重置鼠标配置。点击后还需要输入 RESET 确认。不会更改 macOS 的滚动方向设置。'],
  resetButton: ['Reset to defaults', '恢复出厂设置'],
  deviceLog: ['Device log', '设备日志'],
  clear: ['Clear', '清空'],
  waiting: ['Waiting to connect.', '等待连接。'],
  footer: ['Local HID bridge + Rust WASM · No account ·', '本地 HID 桥 + Rust WASM · 无账户 ·'],
  buttonReference: ['Button protocol by geezmolycos', '感谢 geezmolycos 的按键协议文档'],
  protocolReference: ['Protocol reference', '协议参考'],
};
let language = localStorage.getItem('language') || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
function tr(en, zh) { return language === 'zh' ? zh : en; }
let bridgeInfo;
function translatePage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  for (const [attribute, target] of [['data-i18n', 'textContent'], ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'ariaLabel'], ['data-i18n-placeholder', 'placeholder']]) {
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
let bindingIds = [];
let bindingRaw;
let bindingKey;
let previousBinding;
let profileBindings;

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
  for (const element of $('binding-form').querySelectorAll('input, select, button')) {
    element.disabled = busy || !connected() || !bindingIds.length;
  }
  $('profile-activate').disabled = busy || !connected() || !bindingIds.length || Number($('binding-profile').value) === 0;
  $('binding-pick').disabled = busy || !connected() || !bindingRaw || bindingKey !== selectedBindingKey();
  for (const id of ['wheel-default', 'wheel-invert']) $(id).disabled = busy || !connected() || !bindingIds.includes(9) || !bindingIds.includes(10);
  $('binding-write').disabled = busy || !connected() || !bindingRaw || bindingKey !== selectedBindingKey();
  $('binding-restore').disabled = busy || !connected() || !previousBinding || previousBinding.key !== selectedBindingKey();
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

const bindingNames = {
  1: ['Left button', '左键'], 2: ['Right button', '右键'], 3: ['Middle button', '中键'],
  4: ['Rear side button', '后侧键'], 5: ['Front side button', '前侧键'],
  0x60: ['DPI button', 'DPI 键'], 9: ['Wheel up', '滚轮上'], 10: ['Wheel down', '滚轮下'],
};
const bindingActions = [
  [0, 'Disable', '禁用', [0, 0, 0, 0, 0, 0, 0]],
  [1, 'Mouse button / wheel', '鼠标按键／滚轮', [1, 1, 4, 0, 0, 0, 0]],
  [2, 'Keyboard key', '键盘按键', [2, 2, 0, 4, 0, 0, 0]],
  [6, 'DPI control', 'DPI 控制', [6, 1, 6, 0, 0, 0, 0]],
  [12, 'Hypershift while held', '按住切换 Hypershift', [12, 1, 1, 0, 0, 0, 0]],
  [9, 'System power key', '系统电源键', [9, 1, 2, 0, 0, 0, 0]],
  [10, 'Media / Consumer key', '媒体／Consumer 键', [10, 2, 0, 0xe9, 0, 0, 0]],
  [11, 'Mouse double click', '鼠标双击', [11, 1, 4, 0, 0, 0, 0]],
  [13, 'Keyboard repeat', '键盘连击', [13, 4, 0, 4, 0, 100, 0]],
  [14, 'Mouse repeat', '鼠标连击', [14, 3, 4, 0, 100, 0, 0]],
];
const supportedBindingTypes = new Set(bindingActions.map(([type]) => type));
const choice = (group, en, zh, bytes, enabled = true) => ({ group, en, zh, bytes, enabled });
const bindingChoices = [
  ...[[9, 'Wheel up', '滚轮上'], [10, 'Wheel down', '滚轮下']].map(([code, en, zh]) => choice('wheel', en, zh, [1, 1, code, 0, 0, 0, 0])),
  choice('profile', 'Next profile · 0x07/01', '下一配置档 · 0x07/01', [7, 1, 1, 0, 0, 0, 0], false),
  choice('profile', 'Previous profile · 0x07/02', '上一配置档 · 0x07/02', [7, 1, 2, 0, 0, 0, 0], false),
  choice('profile', 'Select profile 1–5 · 0x07/03', '指定配置档 1–5 · 0x07/03', [7, 2, 3, 1, 0, 0, 0], false),
  choice('profile', 'Next profile, wrap · 0x07/04', '下一配置档，循环 · 0x07/04', [7, 1, 4, 0, 0, 0, 0], false),
  choice('profile', 'Previous profile, wrap · 0x07/05', '上一配置档，循环 · 0x07/05', [7, 1, 5, 0, 0, 0, 0], false),
  ...[[1, 'Left click', '左键'], [2, 'Right click', '右键'], [3, 'Middle click', '中键'], [4, 'Back', '后退'], [5, 'Forward', '前进'], [6, 'Mouse button 6', '鼠标键 6'], [7, 'Mouse button 7', '鼠标键 7'], [8, 'Mouse button 8', '鼠标键 8']].map(([code, en, zh]) => choice('mouse', en, zh, [1, 1, code, 0, 0, 0, 0])),
  choice('mouse', 'Double click · left', '双击左键', [11, 1, 1, 0, 0, 0, 0]),
  choice('mouse', 'Repeat click · left', '连击左键', [14, 3, 1, 0, 100, 0, 0]),
  ...[[1, 'Next DPI stage', '下一 DPI 档'], [2, 'Previous DPI stage', '上一 DPI 档'], [6, 'Next DPI stage, wrap', '下一 DPI 档，循环'], [7, 'Previous DPI stage, wrap', '上一 DPI 档，循环']].map(([code, en, zh]) => choice('dpi', en, zh, [6, 1, code, 0, 0, 0, 0])),
  choice('dpi', 'Select DPI stage 1', '指定 DPI 档位 1', [6, 2, 3, 1, 0, 0, 0]),
  choice('dpi', 'Temporary 800 DPI', '临时 800 DPI', [6, 5, 5, 3, 32, 3, 32]),
  choice('keyboard', 'Keyboard key (choose code below)', '键盘按键（下方选择键码）', [2, 2, 0, 4, 0, 0, 0]),
  choice('keyboard', 'Keyboard repeat', '键盘连击', [13, 4, 0, 4, 0, 100, 0]),
  ...[[1, 'Power down', '关机'], [2, 'Sleep', '睡眠'], [4, 'Wake', '唤醒']].map(([code, en, zh]) => choice('system', en, zh, [9, 1, code, 0, 0, 0, 0])),
  ...[[0xe9, 'Volume up', '音量增加'], [0xea, 'Volume down', '音量减少'], [0xe2, 'Mute', '静音'], [0xcd, 'Play / pause', '播放／暂停'], [0xb5, 'Next track', '下一曲'], [0xb6, 'Previous track', '上一曲']].map(([code, en, zh]) => choice('media', en, zh, [10, 2, 0, code, 0, 0, 0])),
  choice('other', 'Hypershift while held', '按住切换 Hypershift', [12, 1, 1, 0, 0, 0, 0]),
  choice('other', 'Disable input', '禁用输入', [0, 0, 0, 0, 0, 0, 0]),
  ...[[3, 'Macro fixed count', '宏：固定次数'], [4, 'Macro while held', '宏：按住触发'], [5, 'Macro toggle', '宏：切换'], [15, 'Macro sequence', '宏：序列'], [18, 'Wheel mode switch', '滚轮模式切换']].map(([type, en, zh]) => choice('unavailable', `${en} · 0x${type.toString(16).padStart(2, '0')}`, `${zh} · 0x${type.toString(16).padStart(2, '0')}`, [type, 0, 0, 0, 0, 0, 0], false)),
];
const choiceGroups = [['wheel', 'Wheel', '滚轮'], ['profile', 'Profile switch · unavailable on this firmware', '配置档切换 · 此固件不执行'], ['mouse', 'Mouse buttons', '鼠标按键'], ['dpi', 'DPI', 'DPI'], ['keyboard', 'Keyboard', '键盘'], ['system', 'System', '系统'], ['media', 'Media', '媒体'], ['other', 'Other', '其他'], ['unavailable', 'Documented but unavailable', '文档中有但此型号不可用']];
const keyboardKeyNames = new Map();
for (let code = 4; code <= 29; code++) keyboardKeyNames.set(code, String.fromCharCode(65 + code - 4));
for (let code = 30; code <= 39; code++) keyboardKeyNames.set(code, String((code - 29) % 10));
['Enter', 'Escape', 'Backspace', 'Tab', 'Space', '-', '=', '[', ']', 'Backslash', '#', ';', "'", '`', ',', '.', '/', 'Caps Lock'].forEach((name, index) => keyboardKeyNames.set(40 + index, name));
for (let code = 58; code <= 69; code++) keyboardKeyNames.set(code, `F${code - 57}`);
['Print Screen', 'Scroll Lock', 'Pause', 'Insert', 'Home', 'Page Up', 'Delete', 'End', 'Page Down', 'Right', 'Left', 'Down', 'Up'].forEach((name, index) => keyboardKeyNames.set(70 + index, name));
['Num Lock', '/', '*', '-', '+', 'Enter', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.'].forEach((name, index) => keyboardKeyNames.set(83 + index, `Keypad ${name}`));
keyboardKeyNames.set(100, 'Non-US backslash'); keyboardKeyNames.set(101, 'Application'); keyboardKeyNames.set(102, 'Power'); keyboardKeyNames.set(103, 'Keypad =');
for (let code = 104; code <= 115; code++) keyboardKeyNames.set(code, `F${code - 91}`);
['Execute', 'Help', 'Menu', 'Select', 'Stop', 'Again', 'Undo', 'Cut', 'Copy', 'Paste', 'Find', 'Mute', 'Volume up', 'Volume down'].forEach((name, index) => keyboardKeyNames.set(116 + index, name));
['Locking Caps Lock', 'Locking Num Lock', 'Locking Scroll Lock', 'Keypad Comma', 'Keypad Equal Sign'].forEach((name, index) => keyboardKeyNames.set(130 + index, name));
for (let code = 0x87; code <= 0x8f; code++) keyboardKeyNames.set(code, `International ${code - 0x86}`);
for (let code = 0x90; code <= 0x98; code++) keyboardKeyNames.set(code, `Language ${code - 0x8f}`);
['Alternate Erase', 'SysReq', 'Cancel', 'Clear', 'Prior', 'Return', 'Separator', 'Out', 'Oper', 'Clear / Again', 'CrSel / Props', 'ExSel'].forEach((name, index) => keyboardKeyNames.set(0x99 + index, name));
['00', '000', 'Thousands Separator', 'Decimal Separator', 'Currency Unit', 'Currency Sub-unit', '(', ')', '{', '}', 'Tab', 'Backspace', 'A', 'B', 'C', 'D', 'E', 'F', 'XOR', '^', '%', '<', '>', '&', '&&', '|', '||', ':', '#', 'Space', '@', '!', 'Memory Store', 'Memory Recall', 'Memory Clear', 'Memory Add', 'Memory Subtract', 'Memory Multiply', 'Memory Divide', '+/-', 'Clear', 'Clear Entry', 'Binary', 'Octal', 'Decimal', 'Hexadecimal'].forEach((name, index) => keyboardKeyNames.set(0xb0 + index, `Keypad ${name}`));
for (const [code, name] of keyboardKeyNames) bindingChoices.push(choice('keyboard', `${name} · HID 0x${code.toString(16).padStart(2, '0')}`, `${name} · HID 0x${code.toString(16).padStart(2, '0')}`, [2, 2, 0, code, 0, 0, 0]));
function renderBindingChoices() {
  const search = $('binding-search').value.trim().toLowerCase();
  const container = $('binding-choices');
  container.replaceChildren();
  for (const [group, en, zh] of choiceGroups) {
    const items = bindingChoices.filter((item) => item.group === group && (!search || `${item.en} ${item.zh} ${bindingHex(item.bytes)}`.toLowerCase().includes(search)));
    if (!items.length) continue;
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = tr(en, zh); section.append(heading);
    const grid = document.createElement('div'); grid.className = 'choice-grid';
    for (const item of items) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${tr(item.en, item.zh)} · ${bindingHex(item.bytes).slice(0, 8)}`;
      button.disabled = !item.enabled;
      if (!item.enabled) button.title = tr('Ignored by this model firmware', '此型号固件会跳过此动作');
      else button.addEventListener('click', () => { setBindingDraft(Uint8Array.from(item.bytes)); $('binding-action').value = String(item.bytes[0]); $('binding-picker').close(); });
      grid.append(button);
    }
    section.append(grid); container.append(section);
  }
}
function selectedBindingKey() { return `${$('binding-profile').value}:${$('binding-input').value}:${$('binding-layer').value}`; }
function bindingHex(bytes) { return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(' '); }
function parseBindingHex() {
  const pieces = $('binding-raw').value.trim().split(/\s+/);
  if (pieces.length !== 7 || pieces.some((piece) => !/^[0-9a-fA-F]{2}$/.test(piece))) throw new Error(tr('Enter exactly seven two-digit hex bytes', '请输入恰好七个两位十六进制字节'));
  const bytes = Uint8Array.from(pieces, (piece) => parseInt(piece, 16));
  if (!supportedBindingTypes.has(bytes[0])) throw new Error(tr('This action category is not executed by this firmware', '此固件不会执行该动作类别'));
  if (bytes[1] > 5) throw new Error(tr('Action data length exceeds five bytes', '动作参数长度不能超过五字节'));
  return bytes;
}

function setBindingDraft(bytes) {
  $('binding-raw').value = bindingHex(bytes);
  renderBindingParameters(bytes);
}

function parameterSelect(label, options, value, onChange) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const select = document.createElement('select');
  select.replaceChildren(...options.map(([code, en, zh]) => new Option(tr(en, zh), String(code))));
  select.value = String(value);
  select.addEventListener('change', () => onChange(Number(select.value)));
  wrapper.append(select);
  return wrapper;
}

function parameterNumber(label, value, min, max, onChange) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.type = 'number'; input.min = String(min); input.max = String(max); input.value = String(value);
  input.addEventListener('change', () => {
    const next = Number(input.value);
    if (!Number.isInteger(next) || next < min || next > max) { input.reportValidity(); return; }
    onChange(next);
  });
  wrapper.append(input);
  return wrapper;
}

function renderBindingParameters(bytes) {
  const area = $('binding-parameters');
  area.replaceChildren();
  if (bytes[0] === 1 || bytes[0] === 11) {
    const targets = [[1, 'Left click', '左键'], [2, 'Right click', '右键'], [3, 'Middle click', '中键'], [4, 'Back', '后退'], [5, 'Forward', '前进'], [6, 'Mouse button 6', '鼠标键 6'], [7, 'Mouse button 7', '鼠标键 7'], [8, 'Mouse button 8', '鼠标键 8'], [9, 'Wheel up', '滚轮上'], [10, 'Wheel down', '滚轮下']];
    area.append(parameterSelect(tr('Output', '输出动作'), targets, bytes[2], (code) => setBindingDraft(Uint8Array.of(bytes[0], 1, code, 0, 0, 0, 0))));
  } else if (bytes[0] === 2) {
    const update = (modifier, key) => setBindingDraft(Uint8Array.of(2, 2, modifier, key, 0, 0, 0));
    area.append(parameterNumber(tr('Modifier mask (0–255)', '修饰键位掩码（0–255）'), bytes[2], 0, 255, (value) => update(value, bytes[3])));
    area.append(parameterNumber(tr('USB HID key code (0–255)', 'USB HID 键码（0–255）'), bytes[3], 0, 255, (value) => update(bytes[2], value)));
  } else if (bytes[0] === 6) {
    const operations = [[1, 'Next stage', '下一档'], [2, 'Previous stage', '上一档'], [3, 'Select stage', '指定档位'], [4, 'Wheel adjusts DPI', '滚轮调节 DPI'], [5, 'Temporary DPI', '临时 DPI'], [6, 'Next stage, wrap', '下一档，循环'], [7, 'Previous stage, wrap', '上一档，循环']];
    area.append(parameterSelect(tr('DPI operation', 'DPI 操作'), operations, bytes[2], (code) => setBindingDraft(Uint8Array.of(6, code === 5 ? 5 : code === 3 ? 2 : 1, code, code === 3 ? 1 : 0, 0, 0, 0))));
    if (bytes[2] === 3) area.append(parameterNumber(tr('Stage number', '档位编号'), bytes[3], 1, 5, (value) => setBindingDraft(Uint8Array.of(6, 2, 3, value, 0, 0, 0))));
    if (bytes[2] === 5) {
      const x = (bytes[3] << 8) | bytes[4], y = (bytes[5] << 8) | bytes[6];
      const update = (nextX, nextY) => setBindingDraft(Uint8Array.of(6, 5, 5, nextX >> 8, nextX & 255, nextY >> 8, nextY & 255));
      area.append(parameterNumber('X DPI', x, 100, 30000, (value) => update(value, y)));
      area.append(parameterNumber('Y DPI', y, 100, 30000, (value) => update(x, value)));
    }
  } else if (bytes[0] === 9) {
    area.append(parameterSelect(tr('System action', '系统动作'), [[1, 'Power down', '关机'], [2, 'Sleep', '睡眠'], [4, 'Wake', '唤醒']], bytes[2], (code) => setBindingDraft(Uint8Array.of(9, 1, code, 0, 0, 0, 0))));
  } else if (bytes[0] === 10) {
    const value = (bytes[2] << 8) | bytes[3];
    area.append(parameterNumber(tr('Consumer usage ID (0–65535)', 'Consumer 键码（0–65535）'), value, 0, 65535, (code) => setBindingDraft(Uint8Array.of(10, 2, code >> 8, code & 255, 0, 0, 0))));
  } else if (bytes[0] === 13) {
    const update = (modifier, key, interval) => setBindingDraft(Uint8Array.of(13, 4, modifier, key, interval >> 8, interval & 255, 0));
    const interval = (bytes[4] << 8) | bytes[5];
    area.append(parameterNumber(tr('Modifier mask', '修饰键掩码'), bytes[2], 0, 255, (value) => update(value, bytes[3], interval)));
    area.append(parameterNumber(tr('Keyboard HID code', '键盘 HID 键码'), bytes[3], 0, 255, (value) => update(bytes[2], value, interval)));
    area.append(parameterNumber(tr('Repeat interval (ms)', '连击间隔（毫秒）'), interval, 1, 65535, (value) => update(bytes[2], bytes[3], value)));
  } else if (bytes[0] === 14) {
    const interval = (bytes[3] << 8) | bytes[4];
    const update = (button, nextInterval) => setBindingDraft(Uint8Array.of(14, 3, button, nextInterval >> 8, nextInterval & 255, 0, 0));
    area.append(parameterSelect(tr('Mouse output', '鼠标输出'), [[1, 'Left', '左键'], [2, 'Right', '右键'], [3, 'Middle', '中键'], [4, 'Back', '后退'], [5, 'Forward', '前进']], bytes[2], (value) => update(value, interval)));
    area.append(parameterNumber(tr('Repeat interval (ms)', '连击间隔（毫秒）'), interval, 1, 65535, (value) => update(bytes[2], value)));
  }
  if (busy || !connected() || !bindingIds.length) for (const element of area.querySelectorAll('input, select')) element.disabled = true;
}

function renderBindingActions() {
  const selected = $('binding-action').value;
  $('binding-action').replaceChildren(...bindingActions.map(([type, en, zh]) => new Option(tr(en, zh), String(type))), new Option(tr('Unsupported stored action (read only)', '未支持的存储动作（只读）'), 'unsupported'));
  $('binding-action').value = selected || (bindingRaw && supportedBindingTypes.has(bindingRaw[0]) ? String(bindingRaw[0]) : 'unsupported');
}

async function readButtonList() {
  const bytes = await transact(2, 0x84, new Uint8Array());
  if (bytes[0] !== 8) throw new Error(tr('Unexpected button count', '按键数量异常'));
  bindingIds = Array.from(bytes.slice(1, 9));
  renderProfileGrid();
  const chosen = Number($('binding-input').value) || 4;
  $('binding-input').replaceChildren(...bindingIds.map((id) => {
    const name = bindingNames[id] || [`Input 0x${id.toString(16)}`, `输入 0x${id.toString(16)}`];
    return new Option(`${tr(...name)} · 0x${id.toString(16).padStart(2, '0')}`, String(id));
  }));
  $('binding-input').value = String(bindingIds.includes(chosen) ? chosen : bindingIds[0]);
  log(tr(`Mapped inputs: ${bindingIds.map((id) => id.toString(16).padStart(2, '0')).join(' ')}`, `可映射输入：${bindingIds.map((id) => id.toString(16).padStart(2, '0')).join(' ')}`));
  updateControls();
}

async function queryBinding(profile = Number($('binding-profile').value), button = Number($('binding-input').value), layer = Number($('binding-layer').value)) {
  if (!bindingIds.includes(button)) throw new Error(tr('Read the input list first', '请先读取输入列表'));
  const bytes = await transact(2, 0x8c, Uint8Array.of(profile, button, layer));
  if (bytes[0] !== profile || bytes[1] !== button || bytes[2] !== layer) throw new Error(tr('Binding reply does not match the selection', '映射响应与当前选择不符'));
  return bytes.slice(3, 10);
}

function bindingSummary(bytes) {
  if (!bytes) return '—';
  const named = bindingChoices.findLast((item) => item.enabled && sameBytes(item.bytes, bytes));
  return named ? tr(named.en, named.zh) : `${tr('Custom', '自定义')} · ${bindingHex(bytes)}`;
}
function renderProfileGrid() {
  const grid = $('profile-grid'); grid.replaceChildren();
  if (!profileBindings) { grid.textContent = tr('Read all buttons to see both layers', '读取全部按键后可查看两个映射层'); return; }
  for (const [id, name] of bindingIds.map((id) => [id, bindingNames[id] || [`Input 0x${id.toString(16)}`, `输入 0x${id.toString(16)}`]])) {
    const row = document.createElement('div'); row.className = 'profile-row';
    const label = document.createElement('strong'); label.textContent = tr(...name); row.append(label);
    for (const layer of [0, 1]) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${layer ? 'Hypershift' : tr('Normal', '普通')}: ${bindingSummary(profileBindings.get(`${id}:${layer}`))}`;
      button.addEventListener('click', async () => {
        $('binding-input').value = String(id); $('binding-layer').value = String(layer);
        await run(tr('Read binding', '读取映射'), readSelectedBinding);
        if (bindingRaw) { renderBindingChoices(); $('binding-picker').showModal(); }
      });
      row.append(button);
    }
    grid.append(row);
  }
}
async function readAllBindings() {
  const profile = Number($('binding-profile').value);
  const next = new Map();
  for (const id of bindingIds) for (const layer of [0, 1]) next.set(`${id}:${layer}`, await queryBinding(profile, id, layer));
  profileBindings = next;
  renderProfileGrid();
  status(tr(`Read all ${bindingIds.length * 2} mappings in profile ${profile}`, `已读取配置档 ${profile} 的 ${bindingIds.length * 2} 项映射`));
}

const wheelDefaultUp = Uint8Array.of(1, 1, 9, 0, 0, 0, 0);
const wheelDefaultDown = Uint8Array.of(1, 1, 10, 0, 0, 0, 0);
function sameBytes(left, right) { return left.every((value, index) => value === right[index]); }
async function readWheelDirection(profile = Number($('binding-profile').value)) {
  const [up, down] = [await queryBinding(profile, 9, 0), await queryBinding(profile, 10, 0)];
  if (profileBindings && profile === Number($('binding-profile').value)) {
    profileBindings.set('9:0', up); profileBindings.set('10:0', down); renderProfileGrid();
  }
  const normal = sameBytes(up, wheelDefaultUp) && sameBytes(down, wheelDefaultDown);
  const inverted = sameBytes(up, wheelDefaultDown) && sameBytes(down, wheelDefaultUp);
  $('wheel-current').textContent = normal ? tr('Default', '默认') : inverted ? tr('Inverted', '已翻转') : tr('Custom mappings', '自定义映射');
  return { up, down, normal, inverted };
}

async function writeWheelDirection(invert) {
  const profile = Number($('binding-profile').value);
  const before = await readWheelDirection(profile);
  if (invert && !before.normal && !before.inverted) throw new Error(tr('Wheel has custom mappings; restore default before inverting', '滚轮已有自定义映射；请先恢复默认再翻转'));
  const targets = invert ? [wheelDefaultDown, wheelDefaultUp] : [wheelDefaultUp, wheelDefaultDown];
  if (sameBytes(before.up, targets[0]) && sameBytes(before.down, targets[1])) { status(tr('Wheel direction already matches', '滚轮方向已是目标设置')); return; }
  try {
    for (const [id, current, target] of [[9, before.up, targets[0]], [10, before.down, targets[1]]]) {
      if (sameBytes(current, target)) continue;
      await transact(2, 0x0c, Uint8Array.of(profile, id, 0, ...target));
      if (!sameBytes(await queryBinding(profile, id, 0), target)) throw new Error(tr('Wheel binding readback mismatch', '滚轮映射读回不一致'));
    }
    const after = await readWheelDirection(profile);
    if (!sameBytes(after.up, targets[0]) || !sameBytes(after.down, targets[1])) throw new Error(tr('Wheel pair readback mismatch', '滚轮两个方向最终读回不一致'));
  } catch (error) {
    for (const [id, original] of [[10, before.down], [9, before.up]]) {
      try {
        if (!sameBytes(await queryBinding(profile, id, 0), original)) {
          await transact(2, 0x0c, Uint8Array.of(profile, id, 0, ...original));
          if (!sameBytes(await queryBinding(profile, id, 0), original)) throw new Error('readback mismatch');
        }
      }
      catch (restoreError) { log(tr(`Wheel rollback failed for input ${id}: ${restoreError}`, `滚轮输入 ${id} 回退失败：${restoreError}`)); }
    }
    try { await readWheelDirection(profile); } catch { $('wheel-current').textContent = '—'; }
    throw error;
  }
  if (Number($('binding-layer').value) === 0 && [9, 10].includes(Number($('binding-input').value))) await readSelectedBinding();
  status(invert ? tr('Wheel direction inverted and verified', '滚轮方向已翻转并读回验证') : tr('Default wheel direction restored and verified', '滚轮默认方向已恢复并读回验证'));
}

async function readSelectedBinding() {
  const bytes = await queryBinding();
  bindingRaw = bytes;
  bindingKey = selectedBindingKey();
  $('binding-current').textContent = bindingHex(bytes);
  $('binding-raw').value = bindingHex(bytes);
  $('binding-action').value = supportedBindingTypes.has(bytes[0]) ? String(bytes[0]) : 'unsupported';
  renderBindingParameters(bytes);
  if (profileBindings) { profileBindings.set(`${Number($('binding-input').value)}:${Number($('binding-layer').value)}`, bytes); renderProfileGrid(); }
  updateControls();
  log(tr(`Binding ${bindingKey}: ${bindingHex(bytes)}`, `按键映射 ${bindingKey}：${bindingHex(bytes)}`));
  return bytes;
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
  bindingRaw = undefined;
  bindingIds = [];
  profileBindings = undefined;
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
  if (connected()) {
    try { await readButtonList(); await readSelectedBinding(); await readWheelDirection(); }
    catch (error) { log(tr(`Button mapping read failed: ${error.message || error}`, `按键映射读取失败：${error.message || error}`)); }
  }
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

renderBindingActions();
renderBindingChoices();
renderProfileGrid();
for (const id of ['binding-profile', 'binding-input', 'binding-layer']) $(id).addEventListener('change', () => {
  bindingRaw = undefined;
  bindingKey = undefined;
  $('binding-current').textContent = '—';
  $('binding-raw').value = '';
  $('binding-parameters').replaceChildren();
  $('wheel-current').textContent = '—';
  if (id === 'binding-profile') { profileBindings = undefined; renderProfileGrid(); }
  updateControls();
  if (id === 'binding-profile' && connected()) run(tr('Read wheel direction', '读取滚轮方向'), readWheelDirection);
});
$('binding-read').addEventListener('click', () => run(tr('Read binding', '读取映射'), readSelectedBinding));
$('profile-read-all').addEventListener('click', () => run(tr('Read all buttons', '读取全部按键'), readAllBindings));
$('profile-activate').addEventListener('click', () => run(tr('Activate profile', '激活配置档'), async () => {
  const profile = Number($('binding-profile').value);
  if (!Number.isInteger(profile) || profile < 1 || profile > 5) throw new Error(tr('Select profile 1–5', '请选择配置档 1–5'));
  await transact(5, 4, Uint8Array.of(profile), 0);
  await refresh();
  status(tr(`Profile ${profile} activation command accepted; active profile was not independently verified`, `配置档 ${profile} 激活命令已被接收；实际活动档尚未独立验证`));
}));
$('binding-pick').addEventListener('click', () => { renderBindingChoices(); $('binding-picker').showModal(); });
$('binding-picker-close').addEventListener('click', () => $('binding-picker').close());
$('binding-search').addEventListener('input', renderBindingChoices);
$('wheel-default').addEventListener('click', () => run(tr('Restore wheel direction', '恢复滚轮方向'), () => writeWheelDirection(false)));
$('wheel-invert').addEventListener('click', () => run(tr('Invert wheel direction', '翻转滚轮方向'), () => writeWheelDirection(true)));
$('binding-action').addEventListener('change', () => {
  const action = bindingActions.find(([type]) => String(type) === $('binding-action').value);
  if (action) setBindingDraft(Uint8Array.from(action[3]));
});
$('binding-raw').addEventListener('change', () => {
  try {
    const bytes = parseBindingHex();
    $('binding-action').value = String(bytes[0]);
    renderBindingParameters(bytes);
  } catch { $('binding-parameters').replaceChildren(); }
});
$('binding-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(tr('Write binding', '写入映射'), async () => {
    if (!bindingRaw || bindingKey !== selectedBindingKey()) throw new Error(tr('Read this binding first', '请先读取当前选择的映射'));
    const desired = parseBindingHex();
    const before = bindingRaw.slice();
    const fresh = await queryBinding();
    if (!fresh.every((value, index) => value === before[index])) throw new Error(tr('Binding changed since the last read; read it again', '映射已变化，请重新读取后再写入'));
    if (desired.every((value, index) => value === before[index])) { status(tr('Binding already matches', '映射已是目标值')); return; }
    const key = bindingKey;
    await transact(2, 0x0c, Uint8Array.of(Number($('binding-profile').value), Number($('binding-input').value), Number($('binding-layer').value), ...desired));
    const actual = await readSelectedBinding();
    if (!actual.every((value, index) => value === desired[index])) throw new Error(tr('Binding readback differs from the requested value', '映射读回与写入值不一致'));
    previousBinding = { key, before, written: desired };
    if ([9, 10].includes(Number($('binding-input').value)) && Number($('binding-layer').value) === 0) await readWheelDirection();
    status(tr(`Binding written and verified: ${bindingHex(actual)}`, `映射已写入并读回：${bindingHex(actual)}`));
  });
});
$('binding-restore').addEventListener('click', () => run(tr('Restore binding', '恢复映射'), async () => {
  if (!previousBinding || previousBinding.key !== selectedBindingKey()) return;
  const fresh = await queryBinding();
  if (!fresh.every((value, index) => value === previousBinding.written[index])) throw new Error(tr('Binding changed after the write; read it again', '写入后映射又发生变化，请重新读取'));
  const desired = previousBinding.before;
  await transact(2, 0x0c, Uint8Array.of(Number($('binding-profile').value), Number($('binding-input').value), Number($('binding-layer').value), ...desired));
  const actual = await readSelectedBinding();
  if (!actual.every((value, index) => value === desired[index])) throw new Error(tr('Restore readback mismatch', '恢复映射后读回不一致'));
  previousBinding = undefined;
  if ([9, 10].includes(Number($('binding-input').value)) && Number($('binding-layer').value) === 0) await readWheelDirection();
  status(tr(`Previous binding restored: ${bindingHex(actual)}`, `已恢复上次映射：${bindingHex(actual)}`));
}));

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
  renderBindingActions();
  renderBindingChoices();
  renderProfileGrid();
  if (bindingRaw) renderBindingParameters(bindingRaw);
  if (connected() && validated) run(tr('Read settings', '读取配置'), refresh);
  else if (connected()) status(tr('Local HID bridge connected; read settings to enable controls', '本地 HID 桥已连接；读取配置后启用选项'));
  else status(tr('WASM ready; start the local HID bridge and connect', 'WASM 已就绪；请启动本地 HID 桥并连接'));
});
