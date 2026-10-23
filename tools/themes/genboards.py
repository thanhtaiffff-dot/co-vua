"""Việc chụp bàn cờ: python3 genboards.py → jobs-boards.json, ảnh vào out/boards/. Mỗi bàn là một hàm vẽ trong board.js."""
import json

BOARDS = ['wood', 'steel', 'bronze', 'cast-iron', 'crystal', 'glass-marbles', 'thick-glass', 'polished-stone',
          'polished-stone-gray', 'pebbles', 'stone-table', 'bubble']
jobs = [{'out': f'out/boards/{b}.png', 'board': True, 'theme': b, 'size': 1024} for b in BOARDS]
json.dump(jobs, open('jobs-boards.json', 'w'))
print(len(jobs), 'jobs')
