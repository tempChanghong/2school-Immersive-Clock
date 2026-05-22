/**
 * 噪音报告 PDF 渲染模板
 * 将报告数据渲染为完整的 HTML 字符串，供 html2canvas → jsPDF 管线使用
 * 与 NoiseReportModal 的 #pdf-export-container 布局保持一致
 */
import SchoolBadge from "../icons/school.png";

import type { ReportData } from "./noiseReportDownloader";

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min} 分 ${sec} 秒`;
  return `${sec} 秒`;
}

function getScoreLevel(score: number): string {
  if (score >= 90) return "优秀";
  if (score >= 70) return "良好";
  if (score >= 50) return "一般";
  return "需改进";
}

function buildDBSeriesSvg(data: ReportData): string {
  const height = 200;
  const width = 900;
  const pad = 50;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const sorted = data.series.slice().sort((a, b) => a.start - b.start);
  if (sorted.length < 2) {
    return `<div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px">数据不足无法绘制图形</div>`;
  }

  const wSize = 7;
  const smoothed = sorted.map((s, i) => {
    const lo = Math.max(0, i - Math.floor(wSize / 2));
    const hi = Math.min(sorted.length, i + Math.ceil(wSize / 2));
    const win = sorted.slice(lo, hi);
    return { ...s, v: win.reduce((sum, n) => sum + n.v, 0) / win.length };
  });

  const minT = Math.min(...smoothed.map((s) => s.start));
  const maxT = Math.max(...smoothed.map((s) => s.t));
  const timeRange = maxT - minT || 1;
  const mapX = (t: number) => pad + ((t - minT) / timeRange) * chartW;
  const mapY = (v: number) => pad + (1 - v / 80) * chartH;

  const thresholdY = mapY(data.thresholdDb);

  const linePoints = smoothed.map((s) => `${mapX(Math.max(s.start, minT))},${mapY(s.v)}`).join(" ");

  const normalAreaPoints =
    `${pad},${chartH + pad} ` +
    smoothed
      .map((s) => `${mapX(Math.max(s.start, minT))},${mapY(Math.min(s.v, data.thresholdDb))}`)
      .join(" ") +
    ` ${pad + chartW},${chartH + pad}`;

  const warnAreaPoints =
    `${pad},${thresholdY} ` +
    smoothed
      .map((s) => `${mapX(Math.max(s.start, minT))},${mapY(Math.max(s.v, data.thresholdDb))}`)
      .join(" ") +
    ` ${pad + chartW},${thresholdY}`;

  return `
  <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1976d2" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#1976d2" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="warnAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d32f2f" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#d32f2f" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <rect x="${pad}" y="${pad}" width="${chartW}" height="${chartH}" fill="#fafafa" rx="4"/>
    <polygon points="${normalAreaPoints}" fill="url(#areaGrad)"/>
    <polygon points="${warnAreaPoints}" fill="url(#warnAreaGrad)"/>
    <line x1="${pad}" y1="${thresholdY}" x2="${pad + chartW}" y2="${thresholdY}" stroke="#f44336" stroke-width="2" stroke-dasharray="6,4"/>
    <text x="${pad + chartW}" y="${thresholdY - 6}" fill="#f44336" font-size="11" text-anchor="end">阈值 ${data.thresholdDb} dB</text>
    <text x="${pad - 8}" y="${pad + 5}" fill="#999" font-size="10" text-anchor="end">80</text>
    <text x="${pad - 8}" y="${thresholdY + 4}" fill="#999" font-size="10" text-anchor="end">${data.thresholdDb}</text>
    <text x="${pad - 8}" y="${pad + chartH + 4}" fill="#999" font-size="10" text-anchor="end">0</text>
    <polyline points="${linePoints}" fill="none" stroke="#1976d2" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function buildDistributionBars(data: ReportData): string {
  const d = data.distribution;
  const colors = { quiet: "#81C784", normal: "#64B5F6", loud: "#FFB74D", severe: "#E57373" };
  const labels = { quiet: "安静", normal: "正常", loud: "吵闹", severe: "极吵" };
  const thresholds = { quiet: "<45", normal: "45-60", loud: "60-75", severe: ">75" };

  return (["quiet", "normal", "loud", "severe"] as const)
    .map((k) => {
      const pct = (d[k] * 100).toFixed(1);
      return `
    <div style="display:flex;align-items:center;margin-bottom:8px">
      <div style="width:50px;font-size:12px;color:#666;text-align:right;margin-right:10px">${labels[k]} ${thresholds[k]}dB</div>
      <div style="flex:1;background:#eee;border-radius:4px;height:20px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${colors[k]};border-radius:4px"></div>
      </div>
      <div style="width:45px;font-size:12px;color:#333;margin-left:8px;text-align:right">${pct}%</div>
    </div>`;
    })
    .join("");
}

export function renderNoiseReportPdfHtml(data: ReportData): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;width:1000px;padding:40px;background:#fff;color:#333;box-sizing:border-box">
  <div style="text-align:center;margin-bottom:40px;border-bottom:2px solid #333;padding-bottom:20px;display:flex;align-items:center;justify-content:center;gap:20px">
    <img src="${SchoolBadge}" alt="School Logo" style="width:64px;height:64px;object-fit:contain" />
    <div style="text-align:left">
      <h2 style="font-size:28px;margin:0 0 8px 0;color:#111;letter-spacing:2px">天津市第二中学</h2>
      <h3 style="font-size:20px;margin:0;color:#555;font-weight:normal">沉浸式自习环境 - 噪音数据专项测评报告</h3>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:30px;font-size:14px;color:#666">
    <div><strong>自习名称：</strong>${data.periodName}</div>
    <div><strong>统计范围：</strong>${data.periodStart} 至 ${data.periodEnd}</div>
    <div><strong>生成时间：</strong>${new Date().toLocaleString("zh-CN")}</div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:40px">
    <div style="padding:15px;background:#f5f5f5;border-radius:8px;border-left:4px solid #1976d2">
      <div style="font-size:14px;color:#666;margin-bottom:5px">环境纪律得分</div>
      <div style="font-size:24px;font-weight:bold;color:#1976d2">${Math.round(data.avgScore)} 分 (${getScoreLevel(Math.round(data.avgScore))})</div>
    </div>
    <div style="padding:15px;background:#f5f5f5;border-radius:8px;border-left:4px solid #388e3c">
      <div style="font-size:14px;color:#666;margin-bottom:5px">有效平均音量</div>
      <div style="font-size:24px;font-weight:bold;color:#388e3c">${data.avgDb.toFixed(1)} dB</div>
    </div>
    <div style="padding:15px;background:#f5f5f5;border-radius:8px;border-left:4px solid #d32f2f">
      <div style="font-size:14px;color:#666;margin-bottom:5px">违规打断次数</div>
      <div style="font-size:24px;font-weight:bold;color:#d32f2f">${data.segmentCount} 次</div>
    </div>
    <div style="padding:15px;background:#f5f5f5;border-radius:8px;border-left:4px solid #fbc02d">
      <div style="font-size:14px;color:#666;margin-bottom:5px">峰值噪音点</div>
      <div style="font-size:24px;font-weight:bold;color:#f57f17">${data.maxDb.toFixed(1)} dB</div>
    </div>
    <div style="padding:15px;background:#f5f5f5;border-radius:8px;border-left:4px solid #7b1fa2">
      <div style="font-size:14px;color:#666;margin-bottom:5px">超阈值累计时长</div>
      <div style="font-size:24px;font-weight:bold;color:#7b1fa2">${formatDuration(data.overDurationMs)}</div>
    </div>
    <div style="padding:15px;background:#f5f5f5;border-radius:8px;border-left:4px solid #0097a7">
      <div style="font-size:14px;color:#666;margin-bottom:5px">数据采集覆盖率</div>
      <div style="font-size:24px;font-weight:bold;color:#0097a7">${data.periodDurationMs > 0 ? ((data.totalMs / data.periodDurationMs) * 100).toFixed(1) : "0.0"}%</div>
    </div>
  </div>

  <div style="margin-bottom:30px">
    <h4 style="font-size:18px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:20px">自习全程 - 核心噪音位准走势</h4>
    ${buildDBSeriesSvg(data)}
  </div>

  <div style="margin-bottom:30px">
    <h4 style="font-size:18px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:20px">噪音等级分布</h4>
    ${buildDistributionBars(data)}
  </div>

  <div style="margin-bottom:30px">
    <h4 style="font-size:18px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:20px">扣分归因</h4>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
      <div style="text-align:center;padding:15px;background:#fafafa;border-radius:8px">
        <div style="font-size:13px;color:#888;margin-bottom:8px">持续吵闹 (权重 40%)</div>
        <div style="font-size:22px;font-weight:bold;color:#FFD54F">${(data.sustainedPenalty * 100).toFixed(0)}%</div>
        <div style="margin-top:8px;height:6px;background:#eee;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${(data.sustainedPenalty * 100).toFixed(0)}%;background:#FFD54F;border-radius:3px"></div>
        </div>
      </div>
      <div style="text-align:center;padding:15px;background:#fafafa;border-radius:8px">
        <div style="font-size:13px;color:#888;margin-bottom:8px">超时比例 (权重 30%)</div>
        <div style="font-size:22px;font-weight:bold;color:#FF8A65">${(data.timePenalty * 100).toFixed(0)}%</div>
        <div style="margin-top:8px;height:6px;background:#eee;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${(data.timePenalty * 100).toFixed(0)}%;background:#FF8A65;border-radius:3px"></div>
        </div>
      </div>
      <div style="text-align:center;padding:15px;background:#fafafa;border-radius:8px">
        <div style="font-size:13px;color:#888;margin-bottom:8px">频繁打断 (权重 30%)</div>
        <div style="font-size:22px;font-weight:bold;color:#F06292">${(data.segmentPenalty * 100).toFixed(0)}%</div>
        <div style="margin-top:8px;height:6px;background:#eee;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${(data.segmentPenalty * 100).toFixed(0)}%;background:#F06292;border-radius:3px"></div>
        </div>
      </div>
    </div>
  </div>

  <div style="padding:20px;background:#fafafa;border-radius:8px;margin-bottom:20px">
    <div style="font-size:15px;color:#555;line-height:1.8">📋 ${data.scoreText}</div>
  </div>

  <div style="text-align:center;color:#bbb;font-size:12px;margin-top:30px">
    由沉浸式时钟自动生成 · ${new Date().toLocaleString("zh-CN")}
  </div>
</div>`;
}
