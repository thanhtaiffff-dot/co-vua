"""Việc chụp quân 2D: python3 genflat.py <tên> <chủ đề,...|all> <quân,...|all> [cỡ] → jobs-<tên>.json, ảnh vào out/<tên>/<chủ đề>/"""
import json, sys
from themes import THEMES
name, themes, pieces = sys.argv[1], sys.argv[2], sys.argv[3]
size = int(sys.argv[4]) if len(sys.argv) > 4 else 320
ids = list(THEMES) if themes == 'all' else themes.split(',')
ps = ["pawn", "knight", "bishop", "rook", "queen", "king"] if pieces == 'all' else pieces.split(',')
jobs = []
for tid in ids:
    t = THEMES[tid]
    for p in ps:
        for c in "wb":
            mat = {**t[c], **t.get("flatMat", {}).get(c, {})}
            j = {"flat": True, "out": f"out/{name}/{tid}/{c}-{p}.png", "svg": open(f"cburnett/{c}-{p}.svg").read(), "color": c,
                 "material": mat, "size": size, "exposure": t.get("exposure", 1), **t.get("flat", {})}
            if "env" in t: j["env"] = t["env"]
            if c in t.get("envSide", {}): j["env"] = {**j.get("env", {}), **t["envSide"][c]}
            j.update(t.get("flatSide", {}).get(c, {}))
            jobs.append(j)
json.dump(jobs, open(f"jobs-{name}.json", "w"))
print(len(jobs), "jobs")
