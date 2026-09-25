# /// script
# requires-python = ">=3.10"
# dependencies = ["hidapi>=0.15,<1", "websockets>=15,<17"]
# ///
"""Loopback-only WebSocket bridge for local WebHID debugging.

Run with: uv run --script scripts/bridge.py
Protocol: JSON request/response, one request at a time per connection.
"""

import asyncio
import json
import time

import hid
from websockets.asyncio.server import serve

HOST = "127.0.0.1"
PORT = 8766
VID = 0x1532
PID = 0x00B8
REPORT_LEN = 91
ORIGINS = [None, "http://127.0.0.1:8765", "http://localhost:8765"]
device = None
device_info = None
device_lock = asyncio.Lock()


def candidates():
    items = list(hid.enumerate(VID, PID))
    # macOS exposes multiple collections per interface. Interface 0 is the
    # control path observed to work with hidapi for this receiver.
    return sorted(items, key=lambda item: (item.get("interface_number") != 0, item.get("interface_number", 99)))


def open_device():
    errors = []
    for item in candidates():
        device = hid.device()
        try:
            device.open_path(item["path"])
            return device, item
        except OSError as error:
            errors.append(str(error))
    raise RuntimeError("找不到可打开的 1532:00B8 接口" + (f"：{errors[-1]}" if errors else ""))


def exchange(device, report):
    if len(report) != REPORT_LEN or report[0] != 0:
        raise ValueError("报文必须为 91 字节且 Report ID 为 0")
    written = device.send_feature_report(report)
    if written not in (90, 91):
        raise RuntimeError(f"Feature Report 写入长度异常：{written}")
    deadline = time.monotonic() + 3
    last = b""
    while time.monotonic() < deadline:
        time.sleep(0.05)
        last = bytes(device.get_feature_report(0, REPORT_LEN))
        if len(last) in (90, 91):
            normalized = b"\0" + last if len(last) == 90 else last
            if normalized[2] == report[2] and normalized[7:9] == report[7:9] and normalized[1] != 1:
                return normalized
    raise TimeoutError(f"设备响应超时；最后报文：{last.hex()}")


def exchange_with_reconnect(report):
    global device, device_info
    if device is None:
        device, device_info = open_device()
    try:
        return exchange(device, report)
    except (OSError, RuntimeError) as error:
        # The receiver may have re-enumerated. Never resend an uncertain write.
        if "写入长度异常：-1" not in str(error) and not isinstance(error, OSError):
            raise
        device.close()
        device = None
        device_info = None
        if not (report[8] & 0x80):
            raise RuntimeError("设备句柄失效；请重新读取配置后重试写入") from error
        device, device_info = open_device()
        return exchange(device, report)


async def handle(socket):
    global device, device_info
    async for message in socket:
        try:
            request = json.loads(message)
            operation = request.get("op")
            if operation == "list":
                response = {"devices": [{
                    "interface": item.get("interface_number"),
                    "usagePage": item.get("usage_page"),
                    "usage": item.get("usage"),
                    "product": item.get("product_string"),
                } for item in candidates()]}
            elif operation == "open":
                async with device_lock:
                    if device is None:
                        device, device_info = await asyncio.to_thread(open_device)
                    response = {"product": device_info.get("product_string"), "interface": device_info.get("interface_number")}
            elif operation == "exchange":
                report = bytes.fromhex(request["report"])
                async with device_lock:
                    raw = await asyncio.to_thread(exchange_with_reconnect, report)
                response = {"report": raw.hex()}
            else:
                raise ValueError("未知操作；支持 list、open、exchange")
            await socket.send(json.dumps({"ok": True, **response}, ensure_ascii=False))
        except (OSError, RuntimeError, ValueError, KeyError, TimeoutError) as error:
            await socket.send(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))


async def main():
    global device
    try:
        async with serve(handle, HOST, PORT, origins=ORIGINS, max_size=4096):
            print(f"open-Viper3HS bridge listening on ws://{HOST}:{PORT}", flush=True)
            await asyncio.Future()
    finally:
        if device is not None:
            device.close()


if __name__ == "__main__":
    asyncio.run(main())
