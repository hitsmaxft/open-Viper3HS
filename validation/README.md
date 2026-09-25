# Viper V3 HyperSpeed 配置验证

日期：2026-09-25。设备接收器 `1532:00B8`，macOS hidapi 的 interface 0。测试前后配置快照均为轮询率 1000 Hz、活动档位 3、档位 400/800/1600/3200/6400 DPI、休眠 300 秒、低电量阈值原始值 `0x4D`（30%）。

## 程序化只读报告

上游候选验证脚本 `scripts/driver/viper_v3_hyperspeed/verify_receiver.py` 生成 [receiver-readonly.json](receiver-readonly.json)：7 个读取事务全部收到状态 `0x02`，事务 ID、Class/Command、XOR 均通过校验。DPI 回包的 `data_size` 为 1，但完整报文的数据区 `00 06 40 06 40` 表示 X/Y 均 1600。

随后一度所有配置 GET 返回设备状态 `0x04`（事务超时），鼠标移动仍正常。停止桥接服务并直接用 hidapi 读取也遇到同样状态。稍后固件版本、Edition ID 与配置读取自行恢复为 `0x02`；[receiver-readonly-latest.json](receiver-readonly-latest.json) 再次记录 7/7 成功。原因尚未定位，页面已明确显示配置事务超时，不再提示鼠标断电。

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

## 环境边界

本机 Chrome WebHID 可以授权设备，但 `HIDDevice.open()` 返回 `Failed to open the device`；另一个 HTTPS WebHID 页面同样失败。本地调试桥通过原生 hidapi 可打开 interface 0，因此上述硬件验证覆盖 WASM 编解码、WebSocket 桥和设备 Feature Report，不代表 Chrome 直接 WebHID 通路已可用。尚未做断电后持久性、Linux 内核驱动实机或固件重刷验证。恢复出厂是破坏性命令，未在本轮重新执行。
