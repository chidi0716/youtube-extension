#!/usr/bin/python3 -I
"""把 results/<mode>.host.log 整理成易讀的時間軸（相對於第一筆記錄的秒數）。

用法：python3 -I spikes/T00/summarize.py spikes/T00/results/silent.host.log ...
"""
import json
import sys

for path in sys.argv[1:]:
    print(f"== {path}")
    rows = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    if not rows:
        print("  (empty)")
        continue
    t0 = rows[0]["t"]
    ticks = 0
    for r in rows:
        d = r.get("data") or {}
        if r["event"] == "msg" and d.get("type") == "tick":
            ticks += 1
            continue
        rel = f"+{r['t'] - t0:7.1f}s pid={r['pid']:<6} {r['event']:<5}"
        if r["event"] == "msg":
            keys = ("type", "starts", "thisInstanceUptimeSec", "portStillOpen", "suspendAfterSec")
            print(rel, {k: d.get(k) for k in keys if k in d})
        else:
            print(rel)
    if ticks:
        print(f"  ({ticks} heartbeat ticks received over the port)")
