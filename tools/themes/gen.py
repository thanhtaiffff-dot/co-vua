"""Tạo danh sách việc chụp: python3 gen.py <tên> <chủ đề,...|all> <quân,...|all> [cỡ] → jobs-<tên>.json, ảnh vào out/<tên>/<chủ đề>/"""
import json, sys
from themes import THEMES
name, themes, pieces = sys.argv[1], sys.argv[2], sys.argv[3]
size = int(sys.argv[4]) if len(sys.argv) > 4 else 320
shape = sys.argv[5] if len(sys.argv) > 5 else 'a'  # a = bo tròn, b = góc cạnh, c = hiện đại thon gọn
CAM = {"frame": 0.8, "aspect": 1.32, "elevation": 36, "baseline": 0.12}
ids = list(THEMES) if themes == 'all' else themes.split(',')
ps = ["pawn", "knight", "bishop", "rook", "queen", "king"] if pieces == 'all' else pieces.split(',')
jobs = []
for tid in ids:
    t = THEMES[tid]
    for p in ps:
        for c in "wb":
            mat = {**t[c], **(t.get("matB", {}).get(c, {}) if shape == 'b' else {}), **(t.get("matC", {}).get(c, {}) if shape == 'c' else {})}
            j = {"out": f"out/{name}/{tid}/{c}-{p}.png", "piece": p, "material": mat, "size": size, **CAM,
                 "exposure": t.get("exposure", 1), "shadow": t.get("shadow", 0.32), "contact": t.get("contact", 0.5)}
            if "env" in t: j["env"] = t["env"]
            if c in t.get("envSide", {}): j["env"] = {**j.get("env", {}), **t["envSide"][c]}
            if shape != 'a':
                j["shape"] = shape
                # Mặt phẳng đứng phản chiếu sàn: sàn studio sáng hơn để mặt kim loại, thủy tinh không bị tối.
                j["env"] = {**j.get("env", {}), "floor": t.get("floorB", 0.45)}
            jobs.append(j)
json.dump(jobs, open(f"jobs-{name}.json", "w"))
print(len(jobs), "jobs")
