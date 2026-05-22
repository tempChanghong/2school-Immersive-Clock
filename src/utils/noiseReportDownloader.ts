/**
 * 噪音报告自动下载器
 * 课时结束后自动生成并下载该时段的噪音检测报告 HTML 文件
 */
import { NoiseReportPeriod } from "../components/NoiseReportModal/NoiseReportModal";

import { getNoiseControlSettings } from "./noiseControlSettings";
import { readNoiseSlices } from "./noiseSliceService";

interface ReportData {
  thresholdDb: number;
  totalMs: number;
  avgDb: number;
  maxDb: number;
  avgScore: number;
  overDurationMs: number;
  segmentCount: number;
  p50Dbfs: number;
  p95Dbfs: number;
  sustainedPenalty: number;
  timePenalty: number;
  segmentPenalty: number;
  distribution: { quiet: number; normal: number; loud: number; severe: number };
  series: { t: number; start: number; v: number; score: number; events: number }[];
  scoreText: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min} 分 ${sec} 秒`;
  return `${sec} 秒`;
}

function formatTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function levelLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: "优秀", color: "#81C784" };
  if (score >= 70) return { text: "良好", color: "#64B5F6" };
  if (score >= 50) return { text: "一般", color: "#FFB74D" };
  return { text: "需改进", color: "#E57373" };
}

export function buildNoiseReportData(period: NoiseReportPeriod): ReportData | null {
  const thresholdDb = getNoiseControlSettings().maxLevelDb;

  const ranges = [{ startTs: period.start.getTime(), endTs: period.end.getTime() }];
  const minStartTs = Math.min(...ranges.map((r) => r.startTs));
  const maxEndTs = Math.max(...ranges.map((r) => r.endTs));

  const slices = readNoiseSlices()
    .filter((s) => ranges.some((r) => s.end >= r.startTs && s.start <= r.endTs))
    .sort((a, b) => a.start - b.start);

  if (slices.length === 0) return null;

  let totalMs = 0;
  let sumAvgDb = 0;
  let maxDb = -Infinity;
  let sumScore = 0;
  let overDurationMs = 0;
  let segmentCount = 0;
  let sumP50 = 0;
  let sumP95 = 0;
  let sumSustainedPenalty = 0;
  let sumTimePenalty = 0;
  let sumSegmentPenalty = 0;

  const distribution = { quiet: 0, normal: 0, loud: 0, severe: 0 };

  const series: ReportData["series"] = [];

  for (const s of slices) {
    let overlapMsSum = 0;
    for (const r of ranges) {
      const overlapStart = Math.max(r.startTs, s.start);
      const overlapEnd = Math.min(r.endTs, s.end);
      if (overlapEnd > overlapStart) {
        overlapMsSum += overlapEnd - overlapStart;
      }
    }
    if (overlapMsSum <= 0) continue;

    const sliceMs = Math.max(1, s.end - s.start);
    const ratio = overlapMsSum / sliceMs;
    const effectiveOverlapMs = (s.raw.sampledDurationMs ?? sliceMs) * ratio;

    totalMs += effectiveOverlapMs;
    sumAvgDb += s.display.avgDb * effectiveOverlapMs;
    sumScore += s.score * effectiveOverlapMs;
    sumP50 += s.raw.p50Dbfs * effectiveOverlapMs;
    sumP95 += s.raw.p95Dbfs * effectiveOverlapMs;
    if (s.display.p95Db > maxDb) maxDb = s.display.p95Db;

    overDurationMs += s.raw.overRatioDbfs * effectiveOverlapMs;
    segmentCount += Math.round(s.raw.segmentCount * ratio);

    sumSustainedPenalty += s.scoreDetail.sustainedPenalty * effectiveOverlapMs;
    sumTimePenalty += s.scoreDetail.timePenalty * effectiveOverlapMs;
    sumSegmentPenalty += s.scoreDetail.segmentPenalty * effectiveOverlapMs;

    const db = s.display.avgDb;
    if (db < 45) distribution.quiet += effectiveOverlapMs;
    else if (db < 60) distribution.normal += effectiveOverlapMs;
    else if (db < 75) distribution.loud += effectiveOverlapMs;
    else distribution.severe += effectiveOverlapMs;

    series.push({
      t: Math.min(Math.max(s.end, minStartTs), maxEndTs),
      start: Math.max(s.start, minStartTs),
      v: s.display.avgDb,
      score: s.score,
      events: s.raw.segmentCount,
    });
  }

  const avgDb = totalMs > 0 ? sumAvgDb / totalMs : 0;
  const avgScore = totalMs > 0 ? sumScore / totalMs : 0;
  const p50Dbfs = totalMs > 0 ? sumP50 / totalMs : 0;
  const p95Dbfs = totalMs > 0 ? sumP95 / totalMs : 0;
  const sustainedPenalty = totalMs > 0 ? sumSustainedPenalty / totalMs : 0;
  const timePenalty = totalMs > 0 ? sumTimePenalty / totalMs : 0;
  const segmentPenalty = totalMs > 0 ? sumSegmentPenalty / totalMs : 0;

  const scoreText =
    avgScore >= 90
      ? "整体纪律良好，环境稳定。"
      : avgScore >= 70
        ? "整体尚可，存在一定噪音干扰。"
        : "纪律偏弱，建议关注持续吵闹与频繁事件段。";

  const periodStart = period.start;
  const periodEnd = period.end;

  return {
    thresholdDb,
    totalMs,
    avgDb,
    maxDb: maxDb === -Infinity ? 0 : maxDb,
    avgScore,
    overDurationMs,
    segmentCount,
    p50Dbfs,
    p95Dbfs,
    sustainedPenalty,
    timePenalty,
    segmentPenalty,
    distribution:
      totalMs > 0
        ? {
            quiet: distribution.quiet / totalMs,
            normal: distribution.normal / totalMs,
            loud: distribution.loud / totalMs,
            severe: distribution.severe / totalMs,
          }
        : { quiet: 0, normal: 0, loud: 0, severe: 0 },
    series,
    scoreText,
    periodName: period.name,
    periodStart: formatTime(periodStart),
    periodEnd: formatTime(periodEnd),
  };
}

function generateReportHtml(data: ReportData): string {
  const scoreBarWidth = Math.min(100, Math.max(0, data.avgScore));
  const scoreBarColor =
    data.avgScore >= 90
      ? "#81C784"
      : data.avgScore >= 70
        ? "#64B5F6"
        : data.avgScore >= 50
          ? "#FFB74D"
          : "#E57373";
  const level = levelLabel(data.avgScore);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>噪音检测报告 - ${data.periodName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 24px; max-width: 700px; margin: 0 auto; }
  .card { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  h1 { font-size: 1.5em; margin-bottom: 4px; }
  .subtitle { color: #888; font-size: 0.85em; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .stat { text-align: center; padding: 12px; background: #fafafa; border-radius: 8px; }
  .stat-value { font-size: 1.8em; font-weight: 700; }
  .stat-label { font-size: 0.75em; color: #888; margin-top: 4px; }
  .score-bar { height: 8px; background: #eee; border-radius: 4px; margin: 12px 0; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
  .level { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 600; color: #fff; margin-left: 8px; }
  .dist-bar { display: flex; height: 24px; border-radius: 12px; overflow: hidden; margin: 8px 0; }
  .dist-seg { display: flex; align-items: center; justify-content: center; font-size: 0.7em; color: #fff; font-weight: 600; }
  .dist-legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; font-size: 0.8em; }
  .dist-legend-item { display: flex; align-items: center; gap: 4px; }
  .dist-dot { width: 10px; height: 10px; border-radius: 50%; }
  .penalty-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .penalty-item { text-align: center; }
  .penalty-bar { height: 6px; background: #eee; border-radius: 3px; margin: 6px 0; overflow: hidden; }
  .penalty-fill { height: 100%; border-radius: 3px; }
  .verdict { font-size: 1em; color: #555; line-height: 1.6; padding: 12px; background: #fafafa; border-radius: 8px; }
  .footer { text-align: center; color: #bbb; font-size: 0.75em; margin-top: 24px; }
</style>
</head>
<body>
<div class="card">
  <h1>${data.periodName} - 噪音检测报告<span class="level" style="background:${level.color}">${level.text}</span></h1>
  <p class="subtitle">${data.periodStart} ~ ${data.periodEnd} · 阈值 ${data.thresholdDb} dB</p>

  <div class="score-bar"><div class="score-bar-fill" style="width:${scoreBarWidth}%;background:${scoreBarColor}"></div></div>

  <div class="grid">
    <div class="stat"><div class="stat-value">${formatDuration(data.totalMs)}</div><div class="stat-label">有效采样时长</div></div>
    <div class="stat"><div class="stat-value">${data.avgScore.toFixed(0)}</div><div class="stat-label">综合评分 / 100</div></div>
    <div class="stat"><div class="stat-value">${data.maxDb.toFixed(0)}</div><div class="stat-label">峰值分贝</div></div>
    <div class="stat"><div class="stat-value">${data.avgDb.toFixed(1)}</div><div class="stat-label">平均分贝</div></div>
    <div class="stat"><div class="stat-value">${formatDuration(data.overDurationMs)}</div><div class="stat-label">超阈值累计时长</div></div>
    <div class="stat"><div class="stat-value">${data.segmentCount}</div><div class="stat-label">违规打断次数</div></div>
  </div>
</div>

<div class="card">
  <h2 style="font-size:1.1em;margin-bottom:12px">噪音等级分布</h2>
  <div class="dist-bar">
    <div class="dist-seg" style="width:${(data.distribution.quiet * 100).toFixed(1)}%;background:#81C784">${data.distribution.quiet > 0.05 ? (data.distribution.quiet * 100).toFixed(0) + "%" : ""}</div>
    <div class="dist-seg" style="width:${(data.distribution.normal * 100).toFixed(1)}%;background:#64B5F6">${data.distribution.normal > 0.05 ? (data.distribution.normal * 100).toFixed(0) + "%" : ""}</div>
    <div class="dist-seg" style="width:${(data.distribution.loud * 100).toFixed(1)}%;background:#FFB74D">${data.distribution.loud > 0.05 ? (data.distribution.loud * 100).toFixed(0) + "%" : ""}</div>
    <div class="dist-seg" style="width:${(data.distribution.severe * 100).toFixed(1)}%;background:#E57373">${data.distribution.severe > 0.05 ? (data.distribution.severe * 100).toFixed(0) + "%" : ""}</div>
  </div>
  <div class="dist-legend">
    <div class="dist-legend-item"><span class="dist-dot" style="background:#81C784"></span>安静 (&lt;45dB) ${(data.distribution.quiet * 100).toFixed(1)}%</div>
    <div class="dist-legend-item"><span class="dist-dot" style="background:#64B5F6"></span>正常 (45-60dB) ${(data.distribution.normal * 100).toFixed(1)}%</div>
    <div class="dist-legend-item"><span class="dist-dot" style="background:#FFB74D"></span>吵闹 (60-75dB) ${(data.distribution.loud * 100).toFixed(1)}%</div>
    <div class="dist-legend-item"><span class="dist-dot" style="background:#E57373"></span>极吵 (&gt;75dB) ${(data.distribution.severe * 100).toFixed(1)}%</div>
  </div>
</div>

<div class="card">
  <h2 style="font-size:1.1em;margin-bottom:12px">扣分归因</h2>
  <div class="penalty-grid">
    <div class="penalty-item">
      <div style="font-size:0.75em;color:#888;margin-bottom:4px">持续吵闹</div>
      <div style="font-size:1.2em;font-weight:700">${(data.sustainedPenalty * 100).toFixed(0)}%</div>
      <div class="penalty-bar"><div class="penalty-fill" style="width:${(data.sustainedPenalty * 100).toFixed(0)}%;background:#FFD54F"></div></div>
      <div style="font-size:0.7em;color:#aaa">权重 40%</div>
    </div>
    <div class="penalty-item">
      <div style="font-size:0.75em;color:#888;margin-bottom:4px">超时比例</div>
      <div style="font-size:1.2em;font-weight:700">${(data.timePenalty * 100).toFixed(0)}%</div>
      <div class="penalty-bar"><div class="penalty-fill" style="width:${(data.timePenalty * 100).toFixed(0)}%;background:#FF8A65"></div></div>
      <div style="font-size:0.7em;color:#aaa">权重 30%</div>
    </div>
    <div class="penalty-item">
      <div style="font-size:0.75em;color:#888;margin-bottom:4px">频繁打断</div>
      <div style="font-size:1.2em;font-weight:700">${(data.segmentPenalty * 100).toFixed(0)}%</div>
      <div class="penalty-bar"><div class="penalty-fill" style="width:${(data.segmentPenalty * 100).toFixed(0)}%;background:#F06292"></div></div>
      <div style="font-size:0.7em;color:#aaa">权重 30%</div>
    </div>
  </div>
</div>

<div class="card">
  <div class="verdict">📋 ${data.scoreText}</div>
</div>

<div class="footer">
  由沉浸式时钟自动生成 · ${new Date().toLocaleString("zh-CN")}
</div>
</body>
</html>`;
}

export function downloadNoiseReport(data: ReportData): void {
  const html = generateReportHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date()
    .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "-");
  const fileName = `噪音报告_${data.periodName}_${dateStr}.html`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
