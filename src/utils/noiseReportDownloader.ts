/**
 * 噪音报告自动下载器
 * 课时结束后自动生成并下载该时段的噪音检测报告 PDF 文件
 * 使用 html2canvas + jsPDF 管线，与 NoiseReportModal 的 PDF 导出保持一致
 */
import { NoiseReportPeriod } from "../components/NoiseReportModal/NoiseReportModal";

import { getNoiseControlSettings } from "./noiseControlSettings";
import { renderNoiseReportPdfHtml } from "./noiseReportRenderer";
import { readNoiseSlices } from "./noiseSliceService";

export interface ReportData {
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
  periodDurationMs: number;
}

function formatTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const periodDurationMs = Math.max(0, period.end.getTime() - period.start.getTime());

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
    periodStart: formatTime(period.start),
    periodEnd: formatTime(period.end),
    periodDurationMs,
  };
}

export async function downloadNoiseReportAsPdf(data: ReportData): Promise<void> {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:1000px;z-index:-1";
  container.innerHTML = renderNoiseReportPdfHtml(data);
  document.body.appendChild(container);

  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const { default: html2canvas } = await import("html2canvas");
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: "#FFFFFF",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    const dateStr = new Date()
      .toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/\//g, "-");
    pdf.save(`噪音自习报告_${data.periodName}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
