# open-Viper3HS

Razer Viper V3 HyperSpeed（原厂接收器 `1532:00B8`）的配置页，可发布到 GitHub Pages。**原厂接收器的配置 Feature Report 位于顶层 Mouse HID collection 内，Chrome/Edge 会保护鼠标报告；在本机浏览器直连不能完成配置。**本地 hidapi 调试桥可驱动同一套网页与 WASM 编解码，不需要 OpenRazer。

## 实现选择

- **自写精简实现**。参考 OpenRazer 的型号分支和报文格式，不引入其 Linux 内核驱动、daemon 或运行时代码。本地工作区的协议分析见父目录 `docs/06_CONFIG_API_ANALYSIS.md`；独立发布此目录时不需要该文档。
- Rust 无依赖 WASM 小核心：构造 91 字节 Feature Report、XOR 校验和响应匹配。
- 原生 JavaScript：WebHID 设备选择、异步事务、配置界面。没有 npm 构建依赖。
- GitHub Pages 只托管 HTML/CSS/JS/WASM。HID 数据留在用户浏览器和设备之间，不会上传到 Pages。

## 功能

读取轮询率、当前 X/Y DPI、DPI 档位、休眠时间、电量、充电状态和低电量提醒阈值。可逐档设置同步 X/Y DPI（100–30000）并选择活动档位，也可设置原厂接收器轮询率（125/500/1000 Hz）、休眠时间（60–900 秒）和低电量提醒（5–30%）；每次写入后读回。恢复出厂设置需输入 `RESET`。没有经本型号验证的按键映射、宏、LOD、Motion Sync、滚轮方向等命令不在界面中。

**验证状态**：七项读取命令已通过这台 `1532:00B8` 设备的 hidapi 路径验证。轮询率、即时 DPI、休眠时间、低电量阈值已做改值读回和恢复；DPI 档位已做活动档位切换、非当前档位改值、逐字节读回、页面刷新后重读和恢复。即时 DPI 写入会在活动档位重新应用时失效，所以界面只提供板载档位编辑。详细记录见 `validation/README.md`。本机 Chrome 授权后 `HIDDevice.open()` 失败；另一浏览器环境能打开 HID 对象，但七项 Feature Report 全部被拒绝。停止本地桥后问题仍在；单独运行 hidapi 成功。接口 0 的 HID 描述符把厂商 Feature Report 包在 Mouse application collection 内，与 [Chrome 的受保护 collection 规则](https://developer.chrome.com/docs/capabilities/hid#security_and_privacy)相符。

页面现在也会逐个尝试同 PID 的已授权 HID 对象；本机两个对象均无法打开。固件级改动的证据、可能路线及恢复缺口见 [WebHID 固件可行性分析](validation/firmware-webhid-feasibility.md)。

## 本地构建

要求 Rust 和 `wasm32-unknown-unknown` target：

```bash
rustup target add wasm32-unknown-unknown
./scripts/build.sh
python3 -m http.server 8765 --directory dist
```

打开 `http://localhost:8765`。`localhost` 和 GitHub Pages 的 HTTPS 均满足 WebHID 的安全上下文要求，但安全上下文不能解除浏览器对 Mouse collection 的保护。

只有成功打开接收器并读回配置后，页面才启用写入选项。本机使用下述调试桥连接。

## 本地 WebSocket 调试桥

在另一个终端运行：

```bash
uv run --script scripts/bridge.py
```

服务只监听 `ws://127.0.0.1:8766`，依赖 `hidapi` 与 `websockets` 由 uv 隔离安装。页面打开在 `http://127.0.0.1:8765` 后，点“连接本地调试桥”，可绕过 Chrome 的 HID 接口限制并继续使用同一套 WASM 报文编码和界面。桥接服务只接受本地预览页的浏览器 Origin 或没有 Origin 的本机程序客户端。GitHub Pages 上的纯静态部署不会自动启动本地桥接服务。

桥在每次配置事务中打开并关闭接收器句柄。实测长期持有句柄时，设备曾返回状态 `0x04`（配置事务超时），而鼠标移动正常；释放旧句柄后配置读取恢复。若页面显示桥已断开，刷新页面会自动重连已选过的本地桥。

程序调试协议为一问一答 JSON：`{"op":"list"}` 枚举接口，`{"op":"open"}` 打开可用接口，`{"op":"exchange","report":"<91 字节十六进制>"}` 发送 Feature Report 并返回 `report` 十六进制。`exchange` 也可发送写入或恢复出厂命令，只在明确知道报文内容时调用。

启动桥接服务后，运行 `node scripts/smoke.mjs`，可不操作 Chrome，直接使用编译好的 WASM 构造并校验四项只读事务。

可用 `CARGO_TARGET_DIR=/path/to/shared/target ./scripts/build.sh` 复用已有 Cargo 缓存。`dist/` 是可删除、可重新生成的发布目录。

## GitHub Pages

把本目录作为独立 GitHub 仓库根目录推送到 `main`。在仓库 Settings → Pages 中把 Source 设为 **GitHub Actions**。`.github/workflows/pages.yml` 会编译 WASM，并且只发布 `dist/`。不应把父目录的官方固件 EXE、ZIP 和逆向备份一起发布。

## 原生备用路径

GitHub Pages 不能加载本机 `hidapi` 动态库。若 Chrome 拒绝该设备接口，可使用父目录 `razer-viper-v3hs-util/razer_viper_v3hs_util.py` 的 hidapi 命令行工具。网页不能在这种情况下自动切换到本机 HID；那会需要本地服务，与纯 Pages 使用方式不同。

## 参考

- [OpenRazer Viper V3 HyperSpeed 型号分支](https://github.com/openrazer/openrazer/blob/6820f9da169d354bc7e6e93a0aa8683a6bb75792/driver/razermouse_driver.c)
- [OpenRazer 报文构造](https://github.com/openrazer/openrazer/blob/6820f9da169d354bc7e6e93a0aa8683a6bb75792/driver/razerchromacommon.c)
- [Chrome WebHID 文档](https://developer.chrome.com/docs/capabilities/hid)
