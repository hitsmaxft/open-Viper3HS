# Viper V3 HyperSpeed 配置验证

日期：2026-09-25。设备接收器 `1532:00B8`，macOS hidapi 的 interface 0。测试前后配置快照均为轮询率 1000 Hz、活动档位 3、档位 400/800/1600/3200/6400 DPI、休眠 300 秒、低电量阈值原始值 `0x4D`（30%）。

## 程序化只读报告

上游候选验证脚本 `scripts/driver/viper_v3_hyperspeed/verify_receiver.py` 生成 [receiver-readonly.json](receiver-readonly.json)：7 个读取事务全部收到状态 `0x02`，事务 ID、Class/Command、XOR 均通过校验。DPI 回包的 `data_size` 为 1，但完整报文的数据区 `00 06 40 06 40` 表示 X/Y 均 1600。

随后一度所有配置 GET 返回设备状态 `0x04`（事务超时），鼠标移动仍正常。停止桥接服务并直接用 hidapi 读取也遇到同样状态。稍后固件版本、Edition ID 与配置读取恢复为 `0x02`；[receiver-readonly-latest.json](receiver-readonly-latest.json) 再次记录 7/7 成功。旧桥再次长期持有句柄后，程序化读取又遇到 `0x04`；停止桥并释放句柄后，直接读取恢复为 7/7。桥现改为每个事务打开并关闭句柄，新桥连续两轮四项 WASM/WS 读取均通过。长期稳定性仍待观察。页面已明确显示配置事务超时，不再提示鼠标断电。

`node scripts/smoke.mjs` 通过 WebSocket 调试桥调用发布用 WASM，读取轮询率、DPI、档位、休眠时间并校验四个响应；结果与 Python 报告相符。浏览器界面连接调试桥后显示 `已读取 7/7 项配置`，刷新页面后自动重连并再次显示 7/7。

## 写入、读回、恢复

| 项目 | 临时写入 | 读回 | 恢复读回 |
|---|---:|---:|---:|
| 轮询率 | 500 Hz | 500 Hz | 1000 Hz |
| 即时 DPI | 1650 | 1650 | 1600 |
| 休眠 | 301 秒 | 301 秒 | 300 秒 |
| 低电量提醒 | 29%（原始值 `0x4A`） | 29% | 30%（`0x4D`） |
| 板载档位 1 | 450 DPI | 450 DPI；页面刷新、重新连接后仍为 450 | 400 DPI |
| 活动档位 | 4 | 4，其他档位字节不变 | 3 |

档位写入使用先读取的 38 字节布局，未修改字段保持原样；编辑同步 X/Y 值时，若第三个 16 位字段原本与 X/Y 相等，则同步更新该字段。恢复后再次读取的完整档位字节与初始快照一致。所有写命令只发送一次；收到 busy 时只轮询响应。

即时 DPI 的 `04/05` 命令虽然立即读回成功，之后鼠标重新应用活动档位会覆盖它。旧版网页把它作为持久设置是错误的；当前界面改为编辑 `04/06` 板载档位。

## 按键映射与滚轮方向

`02/84` 在实机列出 `01 02 03 04 05 60 09 0A` 八个输入，其中 `04/05` 是两个侧键，`09/0A` 是滚轮上/下。`02/8C` 读到活动 RAM（Profile 0）和 Profile 1 的原始七字节映射。随后仅对 Profile 0 普通层执行 `02/0C`，把滚轮上/下的输出动作互换；两次写入都返回 `0x02`，再次读取也与写入值一致，用户在浏览器长页面上实测滚动方向已反转。Profile 1–5 的两个滚轮映射逐档只读核对，仍为出厂值。本次没有断电重连，因此没有证明 Profile 1–5 的写入持久性。

网页现提供两个侧键和滚轮等输入的映射编辑、Profile 的 16 格普通／Hypershift 总览、可搜索的动作与 HID 键码面板，以及滚轮恢复默认、翻转快捷按钮。面板中的 Profile 切换动作 `0x07` 被禁用，因为该型号固件动作分派会跳过它。另有独立的 `05/04` 配置档激活按钮，尚未在此接收器上验证效果。JavaScript 语法检查、WASM 构建和本地 Chrome 页面布局检查通过。页面新按钮的实机端到端写入尚未验证：本次验证时本地桥 HID 枚举返回空列表，打开接口返回「找不到可打开的 1532:00B8 接口」。这不影响此前通过独立脚本完成的滚轮 RAM 改值、读回和用户物理确认。

## 环境边界

本机 Chrome WebHID 可以授权设备，但 `HIDDevice.open()` 返回 `Failed to open the device`；另一个 HTTPS WebHID 页面同样失败。2026-09-25 11:29 本地桥进程已停止且 `8766` 无监听，Chrome 再次授权后打开接口仍失败；11:30 独立 hidapi 只读脚本能打开 interface 0 并读取配置。桥占用 HID 不是这次直连失败的充分解释。Chrome `open()` 失败的底层原因尚未单独定位。本地桥验证覆盖 WASM 编解码、WebSocket 桥和设备 Feature Report，不代表 Chrome 直接 WebHID 通路已可用。尚未做断电后持久性、Linux 内核驱动实机或固件重刷验证。恢复出厂是破坏性命令，未在本轮重新执行。

进一步读取 interface 0 的 94 字节 HID 描述符：顶层 Application collection 为 `05 01 09 02 A1 01`（Generic Desktop / Mouse），其中 `06 00 FF 09 02 ... 75 08 95 5A B1 01` 定义 90 字节厂商 Feature Report。浏览器实际暴露的 collections 包含 `01:02`；另一浏览器环境虽能 `open()`，全部七项 `sendFeatureReport(0, ...)` 均返回 `Failed to write the feature report`。这与 Chrome 官方的受保护 Mouse collection 规则吻合。原厂固件未另设独立、可供网页访问的厂商配置 collection，故仅靠 GitHub Pages + 标准 WebHID 在当前硬件上不可用。

参照 RazerKit 的做法，页面现枚举并尝试同 PID 所有已授权 `HIDDevice`。桥完全停止时，Chrome `requestDevice()` 本次返回 0 个对象，`getDevices()` 返回 2 个授权对象：collections 分别为 `01:02` 与 `01:02, 0C:01, 01:00 ...`。两个对象都在 `open()` 阶段返回 `Failed to open the device`。因此仅把 `chosen[0]` 改为逐个尝试没有解决本机的直连问题。用户在 RazerKit 页面也复现连接失败。
