# open-Viper3HS

[English](#english) · [中文](#中文)

## English

open-Viper3HS is a compact configuration page for the Razer Viper V3 HyperSpeed with the stock `1532:00B8` receiver. It uses a small Rust WASM report codec, a static web page, and a local hidapi WebSocket bridge. It does not require OpenRazer or an account.

### Quick start

On the computer connected to the receiver, install [uv](https://docs.astral.sh/uv/getting-started/installation/), then download the source and start the bridge:

```bash
git clone https://github.com/hitsmaxft/open-Viper3HS.git
cd open-Viper3HS
uv run --script scripts/bridge.py
```

Keep that terminal running. On the **same computer**, open the [GitHub Pages configurator](https://gh.bhee.online/open-Viper3HS/) in Chrome or Edge and select **Connect local HID bridge**. Once the page shows **Read 7/7 settings**, the controls are available. The bridge listens on `127.0.0.1:8766` only. If the browser asks for local network access, allow access to the bridge.

To host the page locally instead, run these commands in another terminal. Building the page requires Rust and the `wasm32-unknown-unknown` target; using GitHub Pages does not.

```bash
rustup target add wasm32-unknown-unknown
./scripts/build.sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Then open `http://127.0.0.1:8765/` and use the same bridge button. The page has an English/中文 switch and remembers the selected language.

### Supported settings and limits

The page reads polling rate, current X/Y DPI, onboard DPI stages, idle time, battery level, charging state, and the low battery alert threshold. It can edit each onboard DPI stage (linked X/Y, 100–30000), select the active stage, set stock receiver polling rate (125/500/1000 Hz), idle time (60–900 seconds), and low battery threshold (5–30%). Writes are read back. Factory reset requires typing `RESET`.

The button editor covers both side buttons, wheel up/down, the DPI button, and the main buttons. For any profile, **Read all buttons** shows its eight inputs in both normal and Hypershift layers; selecting a cell opens a searchable action picker with concrete mouse, DPI, keyboard HID, media, and system codes. The editor reads a seven-byte mapping before editing and verifies every write by reading it back. The wheel has **Restore default** and **Invert direction** shortcuts; both update the selected profile's normal layer. Profile `0` is temporary active RAM, while profiles `1`–`5` have separate firmware mapping tables. Power-loss persistence of profile writes has not yet been tested. A separate **Activate selected profile** control sends updater command `05/04`; its effect on this receiver is not yet verified. The published button protocol also describes profile-switch action `0x07`, but this model's firmware skips that action, so the picker shows it as unavailable. Macros, lift off distance, and Motion Sync are not offered for this firmware. Temporary DPI writes are not offered because reapplying the active onboard stage replaces them.

The receiver puts its configuration Feature Report inside a protected Mouse HID collection. Chrome/Edge cannot access it through direct WebHID, so that button is disabled. GitHub Pages serves only static HTML/CSS/JS/WASM; the receiver data is exchanged through your own loopback bridge. The bridge accepts the hosted page, the local preview, and local clients without an Origin header. It opens and closes the HID handle for each transaction after a long held handle caused status `0x04` timeouts while pointer movement still worked.

Seven setting reads and the button input/mapping reads were tested through hidapi on this receiver. A temporary RAM wheel inversion was read back, then physically confirmed by scrolling; profiles 1–5 were read only and retained their default wheel mappings. DPI stages were changed, read back byte for byte, reloaded after a page refresh, and restored. See the [validation log](validation/README.md) and [WebHID firmware feasibility analysis](validation/firmware-webhid-feasibility.md). Direct WebHID failed even after stopping the bridge. The stock receiver's protected HID descriptor matches [Chrome's protected collection rules](https://developer.chrome.com/docs/capabilities/hid#security_and_privacy).

### Development and diagnostics

`core/` contains the dependency free Rust WASM codec for 91 byte reports, XOR checksums, and reply matching. `web/` contains the page and native JavaScript; there is no npm build dependency. `scripts/bridge.py` provides a one request, one reply JSON protocol:

- `{"op":"list"}` lists HID interfaces.
- `{"op":"open"}` selects the usable interface.
- `{"op":"exchange","report":"<91-byte hex report>"}` sends a report and returns a hex `report`. This operation can also write settings or reset the device, so construct reports deliberately.

With the bridge running, `node scripts/smoke.mjs` checks four read only transactions using the built WASM codec. Set `CARGO_TARGET_DIR=/path/to/shared/target` to reuse a Cargo cache. The Pages workflow builds and publishes `dist/` from the [source repository](https://github.com/hitsmaxft/open-Viper3HS).

If the bridge cannot be used, the parent workspace contains a hidapi CLI at `razer-viper-v3hs-util/razer_viper_v3hs_util.py`. A standalone GitHub Pages page using standard WebHID cannot configure this receiver's stock firmware.

Protocol references and thanks: [geezmolycos/razerqdhid button command documentation](https://github.com/geezmolycos/razerqdhid/blob/main/docs/cmd_button.md) documents the mapping format and action codes; thank you to its author for publishing the reverse engineering. Keyboard names and usage codes in the picker follow the [USB HID Usage Tables, Keyboard/Keypad page](https://usb.org/sites/default/files/hut1_5.pdf). This project's Viper V3 HyperSpeed action support is also checked against this model's firmware. See [OpenRazer device branch](https://github.com/openrazer/openrazer/blob/6820f9da169d354bc7e6e93a0aa8683a6bb75792/driver/razermouse_driver.c), [report constructors](https://github.com/openrazer/openrazer/blob/6820f9da169d354bc7e6e93a0aa8683a6bb75792/driver/razerchromacommon.c), and [Chrome WebHID](https://developer.chrome.com/docs/capabilities/hid).

## 中文

Razer Viper V3 HyperSpeed（原厂接收器 `1532:00B8`）的配置页。**先在连接鼠标的电脑上启动本地 HID 桥，再打开 [GitHub Pages](https://gh.bhee.online/open-Viper3HS/) 或自行启动网页，点击「连接本地 HID 桥」。**原厂接收器的配置 Feature Report 位于顶层 Mouse HID collection 内，Chrome/Edge WebHID 无法直接访问；页面中的 WebHID 按钮因此禁用。无需 OpenRazer。

## 使用

在连接接收器的电脑上下载源码并启动桥（需要安装 [uv](https://docs.astral.sh/uv/getting-started/installation/)）：

```bash
git clone https://github.com/hitsmaxft/open-Viper3HS.git
cd open-Viper3HS
uv run --script scripts/bridge.py
```

保持终端运行，用同一台电脑的 Chrome/Edge 打开 [GitHub Pages 配置页](https://gh.bhee.online/open-Viper3HS/)，点击 **连接本地 HID 桥**。页面应显示「已读取 7/7 项配置」，随后才能修改选项。桥只监听 `127.0.0.1:8766`；网页和接收器必须在同一台电脑上。浏览器若要求授予页面访问本地网络的权限，需要允许它连接本机桥。

也可自行启动网页：在另一个终端运行 `./scripts/build.sh`，再执行 `python3 -m http.server 8765 --bind 127.0.0.1 --directory dist`，打开 `http://127.0.0.1:8765/` 并点击同一个连接按钮。自行构建网页需要 Rust 和 `wasm32-unknown-unknown` target；使用 GitHub Pages 不需要构建网页。

## 实现选择

- **自写精简实现**。参考 OpenRazer 的型号分支和报文格式，不引入其 Linux 内核驱动、daemon 或运行时代码。本地工作区的协议分析见父目录 `docs/06_CONFIG_API_ANALYSIS.md`；独立发布此目录时不需要该文档。
- Rust 无依赖 WASM 小核心：构造 91 字节 Feature Report、XOR 校验和响应匹配。
- 原生 JavaScript：本地 WebSocket 事务、配置界面；保留禁用状态的 WebHID 实验代码。没有 npm 构建依赖。
- GitHub Pages 只托管 HTML/CSS/JS/WASM。配置报文经本机回环 WebSocket 与本机接收器交换，不上传到 Pages。

## 功能

读取轮询率、当前 X/Y DPI、DPI 档位、休眠时间、电量、充电状态和低电量提醒阈值。可逐档设置同步 X/Y DPI（100–30000）并选择活动档位，也可设置原厂接收器轮询率（125/500/1000 Hz）、休眠时间（60–900 秒）和低电量提醒（5–30%）；每次写入后读回。按键编辑器支持两个侧键、滚轮上下、DPI 键和主按键。「读取全部按键」可展示所选 Profile 的八个输入和普通／Hypershift 两层映射；点击格子会弹出可搜索的动作面板，列出具体鼠标、DPI、键盘 HID、媒体和系统键码。滚轮有「恢复默认」「翻转方向」快捷按钮，作用于所选配置档的普通层。`profile=0` 是临时活动 RAM 映射；`1`–`5` 有独立的固件映射表，但本机尚未测试断电后能否保存写入。另有「激活所选配置档」按钮调用更新器已知的 `05/04` 命令，其在此接收器上的实际效果尚未验证。引用文档的按键切换 Profile 动作 `0x07` 在此型号固件中被跳过，面板会列出并标注不可用。恢复出厂设置需输入 `RESET`。宏、LOD、Motion Sync 暂不提供。

**验证状态**：七项配置读取以及按键列表、映射读取已通过这台 `1532:00B8` 设备的 hidapi 路径验证。活动 RAM 滚轮映射已改值读回，用户实测滚动方向确已翻转；Profile 1–5 只读核对仍为默认映射。轮询率、即时 DPI、休眠时间、低电量阈值已做改值读回和恢复；DPI 档位已做活动档位切换、非当前档位改值、逐字节读回、页面刷新后重读和恢复。即时 DPI 写入会在活动档位重新应用时失效，所以界面只提供板载档位编辑。详细记录见 `validation/README.md`。本机 Chrome 授权后 `HIDDevice.open()` 失败；另一浏览器环境能打开 HID 对象，但七项 Feature Report 全部被拒绝。停止本地桥后问题仍在；单独运行 hidapi 成功。接口 0 的 HID 描述符把厂商 Feature Report 包在 Mouse application collection 内，与 [Chrome 的受保护 collection 规则](https://developer.chrome.com/docs/capabilities/hid#security_and_privacy)相符。

页面现在也会逐个尝试同 PID 的已授权 HID 对象；本机两个对象均无法打开。固件级改动的证据、可能路线及恢复缺口见 [WebHID 固件可行性分析](validation/firmware-webhid-feasibility.md)。

## 本地构建细节

要求 Rust 和 `wasm32-unknown-unknown` target：

```bash
rustup target add wasm32-unknown-unknown
./scripts/build.sh
python3 -m http.server 8765 --directory dist
```

只有成功通过本地桥读回配置后，页面才启用写入选项。`localhost` 和 GitHub Pages 的 HTTPS 虽都满足 WebHID 的安全上下文要求，安全上下文不能解除浏览器对 Mouse collection 的保护。

## 本地 WebSocket 调试桥

在另一个终端运行：

```bash
uv run --script scripts/bridge.py
```

服务只监听 `ws://127.0.0.1:8766`，依赖 `hidapi` 与 `websockets` 由 uv 隔离安装。GitHub Pages 或本地页面点击「连接本地 HID 桥」，即可使用同一套 WASM 报文编码和界面。桥接服务只接受 `https://gh.bhee.online`、本地预览页的浏览器 Origin，或没有 Origin 的本机程序客户端。GitHub Pages 只提供静态网页，用户需自行启动本地桥。

桥在每次配置事务中打开并关闭接收器句柄。实测长期持有句柄时，设备曾返回状态 `0x04`（配置事务超时），而鼠标移动正常；释放旧句柄后配置读取恢复。若页面显示桥已断开，刷新页面会自动重连已选过的本地桥。

程序调试协议为一问一答 JSON：`{"op":"list"}` 枚举接口，`{"op":"open"}` 打开可用接口，`{"op":"exchange","report":"<91 字节十六进制>"}` 发送 Feature Report 并返回 `report` 十六进制。`exchange` 也可发送写入或恢复出厂命令，只在明确知道报文内容时调用。

启动桥接服务后，运行 `node scripts/smoke.mjs`，可不操作 Chrome，直接使用编译好的 WASM 构造并校验四项只读事务。

可用 `CARGO_TARGET_DIR=/path/to/shared/target ./scripts/build.sh` 复用已有 Cargo 缓存。`dist/` 是可删除、可重新生成的发布目录。

## GitHub Pages

源码在 [hitsmaxft/open-Viper3HS](https://github.com/hitsmaxft/open-Viper3HS)，网页在 [GitHub Pages](https://gh.bhee.online/open-Viper3HS/)。`.github/workflows/pages.yml` 会编译 WASM，并且只发布 `dist/`。网页不能单独访问这只原厂接收器，必须先运行本地桥。

## 原生备用路径

若不能运行本地桥，可使用父目录 `razer-viper-v3hs-util/razer_viper_v3hs_util.py` 的 hidapi 命令行工具。纯 GitHub Pages + 标准 WebHID 在这只接收器的原厂固件上不可用。

## 参考

- 感谢 [geezmolycos/razerqdhid 的按键命令文档](https://github.com/geezmolycos/razerqdhid/blob/main/docs/cmd_button.md) 公开映射格式和动作编码。本项目还逐项对照了 Viper V3 HyperSpeed 固件的实际动作分支。
- 按键选择面板中的键盘名称和键码参考 [USB HID Usage Tables 的 Keyboard/Keypad 页](https://usb.org/sites/default/files/hut1_5.pdf)。
- [OpenRazer Viper V3 HyperSpeed 型号分支](https://github.com/openrazer/openrazer/blob/6820f9da169d354bc7e6e93a0aa8683a6bb75792/driver/razermouse_driver.c)
- [OpenRazer 报文构造](https://github.com/openrazer/openrazer/blob/6820f9da169d354bc7e6e93a0aa8683a6bb75792/driver/razerchromacommon.c)
- [Chrome WebHID 文档](https://developer.chrome.com/docs/capabilities/hid)
