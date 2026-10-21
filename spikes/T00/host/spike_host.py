#!/usr/bin/python3 -I
"""T00 最小原生訊息 host（實驗用，非正式橋接程式）。

每個收到的訊息都附上時間戳寫進記錄檔並原樣回覆；
stdin 關閉（EOF）時也記錄一筆，用來判斷瀏覽器何時關閉連線。
"""
import json
import os
import struct
import sys
import time

LOG = os.environ.get(
    "T00_LOG",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results", "host.log"),
)


def log(event, data=None):
    line = {"t": round(time.time(), 3), "pid": os.getpid(), "event": event}
    if data is not None:
        line["data"] = data
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(line, ensure_ascii=False) + "\n")


def read_message():
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        return None
    (length,) = struct.unpack("=I", raw_len)
    return json.loads(sys.stdin.buffer.read(length).decode("utf-8"))


def send_message(obj):
    data = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def main():
    log("start", {"argv": sys.argv[1:]})
    while True:
        msg = read_message()
        if msg is None:
            log("eof")
            return
        log("msg", msg)
        send_message({"echo": msg})


if __name__ == "__main__":
    main()
