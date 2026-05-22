# 代码审查报告：噪音报告自动下载修复

**审查目标**：Deepseek V4 Pro 基于 [implementation_plan.md](file:///C:/Users/Changhong/.gemini/antigravity/brain/531f37f9-aaa1-455d-81f7-c270c27d427f/implementation_plan.md) 实施的代码变更

**审查范围**：
- [noiseReportDownloader.ts](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/utils/noiseReportDownloader.ts) — 修改
- [noiseReportRenderer.ts](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/utils/noiseReportRenderer.ts) — 新增
- [Study.tsx](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/Study/Study.tsx) — 修改

---

## 验证通过项 ✅

| 检查项 | 状态 |
|--------|------|
| TypeScript 编译 | ✅ 无新增 TS 错误（仅有 `useMasonryLayout.ts` 的预存错误） |
| ESLint | ✅ 三个文件全部通过 |
| 旧 API 残留引用 | ✅ `downloadNoiseReport` 已无任何引用 |
| 导入排序 | ✅ 符合 AGENTS.md 规范（React → 本地模块 → 样式） |
| `downloadNoiseReportAsPdf` 异步签名 | ✅ 正确返回 `Promise<void>` |
| 离屏 DOM 清理 | ✅ `finally` 块中 `removeChild` 确保不泄漏 |
| PDF 管线 (html2canvas + jsPDF) | ✅ 与 NoiseReportModal 使用相同依赖和参数 |

### Study.tsx 防重复修复验证 ✅

| 修复项 | 状态 |
|--------|------|
| `autoDownloadedPeriodIdRef` → `autoDownloadedPeriodsRef: Set<string>` | ✅ [第 46 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/Study/Study.tsx#L46) |
| 删除结束前 1 分钟窗口的重置逻辑 | ✅ 已删除（第 151-153 行的原 `autoDownloadedPeriodIdRef.current = null`） |
| 日期维度防重键 `p.id::todayDateStr` | ✅ [第 143 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/Study/Study.tsx#L143) |
| `reportOpen` 从依赖中移除 | ✅ [第 173 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/Study/Study.tsx#L173) `[currentTime]` |
| 10 秒节流保护 | ✅ [第 145 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/Study/Study.tsx#L145) |
| 异步下载不阻塞 | ✅ `.catch(() => {})` 不影响后续逻辑（但有规范问题，见下） |

---

## 发现的问题

### 🔴 严重问题

#### 1. `ReportData` 接口重复定义

[noiseReportRenderer.ts 第 8-28 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/utils/noiseReportRenderer.ts#L8-L28) 重新定义了 `ReportData` 接口，而非从 `noiseReportDownloader.ts` 导入。

**风险**：两处定义的字段如果未来不同步修改，会导致静默的类型不匹配。TypeScript 的结构类型系统让这个问题在编译时不报错，但运行时可能缺失字段。

```diff
- interface ReportData {
-   // ...28 行重复定义
- }
+ import type { ReportData } from "./noiseReportDownloader";
```

---

#### 2. SVG 图表缺少滑动平均滤波

[noiseReportRenderer.ts `buildDBSeriesSvg`](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/utils/noiseReportRenderer.ts#L45-L96) 使用原始 `series[].v` 值直接绘制 `<polyline>`。

而 [NoiseReportModal.tsx 第 486-504 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/NoiseReportModal/NoiseReportModal.tsx#L486-L505) 使用了**窗口大小为 7 的滑动平均**和**贝塞尔曲线平滑**（`getSmoothPath`），显著减少数据毛刺：

```typescript
// NoiseReportModal 中的处理
const windowSize = 7;
const startIdx = Math.max(0, i - Math.floor(windowSize / 2));
const endIdx = Math.min(sortedSeries.length, i + Math.ceil(windowSize / 2));
const window = sortedSeries.slice(startIdx, endIdx);
const avgV = window.reduce((sum, n) => sum + n.v, 0) / window.length;
```

**影响**：自动下载的 PDF 中图表会有严重毛刺/锯齿，与手动导出的平滑曲线视觉差异巨大。

**修复建议**：在 `buildDBSeriesSvg` 中加入滑动平均预处理：

```typescript
const sorted = series.slice().sort((a, b) => a.start - b.start);
const smoothed = sorted.map((s, i) => {
  const wSize = 7;
  const lo = Math.max(0, i - Math.floor(wSize / 2));
  const hi = Math.min(sorted.length, i + Math.ceil(wSize / 2));
  const win = sorted.slice(lo, hi);
  return { ...s, v: win.reduce((sum, n) => sum + n.v, 0) / win.length };
});
```

---

#### 3. SVG 图表缺少超标区域红色面积填充

[NoiseReportModal 的 PDF 模板](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/NoiseReportModal/NoiseReportModal.tsx#L1083-L1170) 有两个面积层：
- 正常区域：蓝色渐变面积（阈值线以下）
- **超标区域**：**红色渐变面积**（阈值线以上），通过 `pdfWarningAreaMask` 遮罩实现

而 `noiseReportRenderer.ts` 只有一个蓝色面积（第 93 行），且只绘制到阈值以下（`Math.min(s.v, data.thresholdDb)`），**超标部分被截断丢失**。

**影响**：PDF 中无法可视化展示噪音超标区间的严重程度，信息丢失。

**修复建议**：增加超标区域的红色面积 polygon：

```typescript
// 超标面积（仅绘制阈值线以上的部分）
const warnAreaPoints = ...;  // 类似正常面积，但使用 Math.max(s.v, data.thresholdDb)
```

---

### 🟡 中等问题

#### 4. `<polyline>` 缺少 `stroke-linejoin` / `stroke-linecap`

[buildDBSeriesSvg 第 94 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/utils/noiseReportRenderer.ts#L94)：

```html
<polyline points="..." fill="none" stroke="#1976d2" stroke-width="2.5"/>
```

`html2canvas` 对 SVG 的渲染一致性取决于浏览器 SVG 引擎。缺少 `stroke-linejoin="round"` 和 `stroke-linecap="round"` 可能导致尖锐转角处出现伪影。

NoiseReportModal 使用的是 `<path>` + 贝塞尔曲线，天然避免了此问题。

**修复建议**：

```diff
- <polyline points="..." fill="none" stroke="#1976d2" stroke-width="2.5"/>
+ <polyline points="..." fill="none" stroke="#1976d2" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
```

---

#### 5. 空 catch 违反 AGENTS.md 规范

[Study.tsx 第 151 行](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/Study/Study.tsx#L151)：

```typescript
downloadNoiseReportAsPdf(reportData).catch(() => {});
```

AGENTS.md 明确规定：
> **绝不在不记录日志的情况下静默错误**（警告级别）

**修复建议**：

```diff
- downloadNoiseReportAsPdf(reportData).catch(() => {});
+ downloadNoiseReportAsPdf(reportData).catch((err) => {
+   logger.error("自动下载噪音报告 PDF 失败:", err);
+ });
```

---

### 🟢 轻微问题

#### 6. `formatDuration` 代码重复

`noiseReportRenderer.ts` 第 30-36 行重新定义了 `formatDuration`，此函数在原 `noiseReportDownloader.ts` 中已有（被删除了），且 [NoiseReportModal 中也有类似实现](file:///c:/Users/Changhong/Documents/Code/Immersive-clock-main/src/components/NoiseReportModal/NoiseReportModal.tsx)。

**建议**：提取到共享工具模块（如 `src/utils/formatTime.ts`），避免多处维护。暂不阻塞发布。

---

#### 7. `ReportData` 中未使用字段

`p50Dbfs`、`p95Dbfs` 在 renderer 中未被渲染到 PDF 模板中。这些是原始信号级别的中位数和 95 百分位数，在 NoiseReportModal 的交互式 UI 中有展示但在 PDF 模板中未出现。

**建议**：考虑在 PDF 模板的指标卡片中增加这两个数据点，或在 ReportData 接口注释中说明"仅供高级分析使用"。

---

## 总结

| 类别 | 数量 | 需修复 |
|------|------|--------|
| 🔴 严重 | 3 | 建议在合并前修复 |
| 🟡 中等 | 2 | 建议在合并前修复 |
| 🟢 轻微 | 2 | 可后续迭代 |

> [!IMPORTANT]
> **核心关注**：防重复下载的逻辑修复**完全正确**，这是最关键的安全修复。PDF 管线的切换也基本正确。问题集中在 PDF 报告模板的**视觉质量**——与手动导出的 PDF 相比，自动下载的 PDF 缺少滑动平均平滑和超标区域可视化，图表质量有明显差距。
>
> 如果你希望我修复上述严重和中等问题，请确认，我可以直接进行修改。
