#!/usr/bin/env python3
"""
Generate a line chart PNG from JSON data passed via stdin.
Usage: echo '{"labels":["1月","2月"],"buy":[100,200],"sell":[0,150]}' | python3 generate_chart.py
Outputs raw PNG bytes to stdout.
"""
import sys
import json
import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

data = json.loads(sys.stdin.read())
labels = data.get("labels", [])
buy_vals = data.get("buy", [])
sell_vals = data.get("sell", [])
profit_vals = [s - b for s, b in zip(sell_vals, buy_vals)]

fig, ax = plt.subplots(figsize=(9, 3.5), dpi=120)
fig.patch.set_facecolor("white")
ax.set_facecolor("#f9fafb")

ax.plot(labels, buy_vals, marker="o", linewidth=2, color="#06038D", label="買取金額 (HKD)")
ax.plot(labels, sell_vals, marker="s", linewidth=2, color="#16a34a", label="賣出金額 (HKD)")
ax.plot(labels, profit_vals, marker="^", linewidth=1.5, linestyle="--", color="#d97706", label="毛利 (HKD)")

ax.set_title("月度買賣趨勢", fontsize=13, fontweight="bold", color="#06038D", pad=10)
ax.set_xlabel("月份", fontsize=9, color="#374151")
ax.set_ylabel("金額 (HKD)", fontsize=9, color="#374151")
ax.legend(fontsize=8, loc="upper left")
ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
ax.tick_params(axis="x", labelsize=8, rotation=30)
ax.tick_params(axis="y", labelsize=8)
ax.grid(axis="y", linestyle="--", alpha=0.5, color="#e5e7eb")
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

plt.tight_layout()
buf = io.BytesIO()
plt.savefig(buf, format="png", bbox_inches="tight", dpi=120)
plt.close(fig)
buf.seek(0)
sys.stdout.buffer.write(buf.read())
