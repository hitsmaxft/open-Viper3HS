# 原厂接收器 WebHID 可行性

2026-09-25，只读分析；没有修改或刷写设备固件。

## 当前 USB 布局

- 原厂接收器 `1532:00B8` 的 macOS hidapi interface 0 可发送/读取 91 字节 Feature Report。
- 该接口的 HID report descriptor 为 94 字节，顶层是 `Generic Desktop / Mouse`（`05 01 09 02 A1 01`）。其内部的 `FF00:02` 厂商 Feature 定义为 `06 00 FF 09 02 15 00 25 01 75 08 95 5A B1 01`，`0x5A` 即 90 字节不含 Report ID 的数据长度。
- 实际从接收器读取的 94 字节描述符，与官方更新包中 `Dev1` 应用镜像地址 `0x0001BFB4` 处的 94 字节逐字节相同。镜像文件为 `firmware/extracted/viper_firmware_out/dev1_0x00010000-0x0001C907.bin`（位于工作区父目录）。
- hidapi 枚举出的三个 USB interface 编号为 0、1、2；顶层用途包含 Mouse、Keyboard、Consumer Control，未发现独立的厂商用途顶层 interface。
- 对 `Dev1` 应用镜像的只读扫描仅找到两处 `Generic Desktop / Mouse` 顶层 collection 起始序列（镜像地址 `0x1BFB4`、`0x1C0A9`），没有找到 `FF00:02` 顶层 collection 起始序列；90 字节厂商 Feature 定义只出现一次，位于前述 Mouse collection 内。设备描述符的 `bNumConfigurations` 为 `1`。这排除了镜像中显而易见的第二套厂商 HID 描述符，但不能排除运行时代码生成、Bootloader 模式或尚未识别的其他描述符。

## 浏览器边界

[Chrome 官方 WebHID 规则](https://developer.chrome.com/docs/capabilities/hid#security_and_privacy)保护 Mouse 等顶层 collection 中的报告。当前配置 Feature 位于 Mouse collection 内。桥停止后，Chrome 对已授权的两个同型号 HID 对象分别尝试 `open()`，两者均失败；另一浏览器环境可 `open()`，但 `sendFeatureReport(0, ...)` 被拒绝。这与受保护 collection 规则相符。RazerKit 的网页源码同样通过 WebHID 枚举已授权对象并逐个尝试，其 README 明确提示此类鼠标 collection 可能被浏览器拦截；用户在该网页也复现连接失败。

## 修改方向与缺口

理论上，接收器固件若提供**独立、顶层厂商用途的配置 HID interface**，并在其中实现原有 90 字节 Feature Report，浏览器才能避开 Mouse collection 的报告保护。仅在现有 Mouse interface 中移动 collection 的边界，仍可能遇到 macOS 对整个鼠标 interface 的 `open()` 限制；需要单独验证，不可当作已可用补丁。

修改 USB composite/configuration descriptor、HID report descriptor、接口与端点分派、配置事务路由之后，还要验证 Bootloader 是否接受修改后的 `Dev1` 镜像，以及断电、固件回滚和接收器恢复路径。当前本地资料只完成应用镜像提取；DFU 擦除、写入、校验和失败恢复未完成实机验证。现阶段没有可安全刷入的固件补丁。

现有逆向材料中的 `00/04` 是更新器使用的设备/升级模式命令，未发现它能在正常工作状态下启用 WebHID 配置接口。单纯切换 HTTPS、重新授权设备或改网页的 report ID，无法改变 Mouse collection 所属关系。可立即使用的方案仍是本地 hidapi 桥；纯 GitHub Pages 直连需要接收器固件新增可由浏览器访问的独立厂商 HID 接口，或另用受控硬件代理暴露这样的接口。
