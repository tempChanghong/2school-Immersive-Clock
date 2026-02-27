import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

import { useAppState } from "../../contexts/AppContext";
import { useTimer } from "../../hooks/useTimer";
import { CountdownItem } from "../../types";
import { DEFAULT_SCHEDULE, StudyPeriod } from "../../types/studySchedule";
import { formatClock } from "../../utils/formatTime";
import { getAutoPopupSetting } from "../../utils/noiseReportSettings";
import { readStudyBackground } from "../../utils/studyBackgroundStorage";
import { ensureInjectedFonts } from "../../utils/studyFontStorage";
import { readStudySchedule } from "../../utils/studyScheduleStorage";
import { getAdjustedDate } from "../../utils/timeSync";
import { getValidCoords, getValidDaily3d, getValidHourly72h } from "../../utils/weatherStorage";
import { MotivationalQuote } from "../MotivationalQuote";
import NoiseHistoryModal from "../NoiseHistoryModal/NoiseHistoryModal";
import NoiseMonitor from "../NoiseMonitor";
import NoiseReportModal, { NoiseReportPeriod } from "../NoiseReportModal/NoiseReportModal";
import StudyStatus from "../StudyStatus";

import { hexToRgba } from "../../utils/colorUtils";

import styles from "./Study.module.css";
/**
 * 自习组件
 * 显示当前时间和倒计时轮播
 */
export function Study() {
  const { study } = useAppState();
  const [currentTime, setCurrentTime] = useState<Date>(getAdjustedDate());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<NoiseReportPeriod | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarSlot, setSidebarSlot] = useState<HTMLElement | null>(null);
  // [新增] 记录报告是否从历史记录界面打开
  const [reportFromHistory, setReportFromHistory] = useState(false);
  // 记录当前课时是否已弹出过报告，以及是否被手动关闭以避免重复弹出
  const lastPopupPeriodIdRef = useRef<string | null>(null);
  const dismissedPeriodIdRef = useRef<string | null>(null);
  const forecastPopupRef = useRef<{ periodId: string; popupId: string } | null>(null);
  const lastForecastPopupPeriodIdRef = useRef<string | null>(null);

  // 背景设置
  const [backgroundSettings, setBackgroundSettings] = useState(readStudyBackground());

  // 轮播：容器与尺寸测量
  const countdownRef = useRef<HTMLDivElement | null>(null);
  const [itemHeight, setItemHeight] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  /**
   * 更新时间
   */
  const updateTime = useCallback(() => {
    setCurrentTime(getAdjustedDate());
  }, []);

  // 挂载时获取 Slot DOM 节点，供右侧面板 Portal 渲染
  useEffect(() => {
    setSidebarSlot(document.getElementById("right-sidebar-slot"));
  }, []);

  // 使用计时器每秒更新时间
  useTimer(updateTime, true, 1000);

  // 组件挂载时立即更新时间
  useEffect(() => {
    updateTime();
  }, [updateTime]);

  // 监听背景设置更新事件
  useEffect(() => {
    const handler = () => setBackgroundSettings(readStudyBackground());
    window.addEventListener("study-background-updated", handler as EventListener);
    return () => window.removeEventListener("study-background-updated", handler as EventListener);
  }, []);

  /**
   * 注入已导入字体（函数级注释：组件挂载时确保本地导入的字体已通过 @font-face 注入到页面）
   */
  useEffect(() => {
    ensureInjectedFonts().catch(console.error);
    const onFontsUpdated = () => {
      ensureInjectedFonts().catch(console.error);
    };
    window.addEventListener("study-fonts-updated", onFontsUpdated as EventListener);
    return () => window.removeEventListener("study-fonts-updated", onFontsUpdated as EventListener);
  }, []);

  // 自动在本节课结束前1分钟弹出统计报告（不自动关闭；若手动关闭则在该课时结束前不再弹出）
  useEffect(() => {
    let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
    try {
      const data = readStudySchedule();
      if (Array.isArray(data) && data.length > 0) schedule = data;
    } catch {}

    const now = getAdjustedDate();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const toDate = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      const d = getAdjustedDate();
      d.setHours(h, m, 0, 0);
      return d;
    };

    for (const p of schedule) {
      const start = toDate(p.startTime);
      const end = toDate(p.endTime);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();

      // 课时已结束，重置当前课时的弹出/关闭标记
      if (nowMin >= endMin) {
        if (lastPopupPeriodIdRef.current === p.id) {
          lastPopupPeriodIdRef.current = null;
        }
        if (dismissedPeriodIdRef.current === p.id) {
          dismissedPeriodIdRef.current = null;
        }
      }

      // 正在本节课内，并且进入结束前1分钟窗口（[end-1min, end)）
      if (nowMin >= startMin && nowMin < endMin && endMin - nowMin <= 1) {
        // 检查是否启用自动弹出设置
        const autoPopupEnabled = getAutoPopupSetting();

        // 若本课时已经弹出过，或被手动关闭过，或设置中禁用了自动弹出，则不再重复弹出
        const alreadyPopped = lastPopupPeriodIdRef.current === p.id;
        const dismissed = dismissedPeriodIdRef.current === p.id;
        if (!alreadyPopped && !dismissed && autoPopupEnabled) {
          setReportPeriod({ id: p.id, name: p.name, start, end });
          setReportOpen(true);
          setReportFromHistory(false); // 自动弹出不属于历史记录来源
          lastPopupPeriodIdRef.current = p.id;
        }
        break;
      }
    }
  }, [currentTime, reportOpen]);

  useEffect(() => {
    if (!study.classEndForecastEnabled) return;

    let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
    try {
      const data = readStudySchedule();
      if (Array.isArray(data) && data.length > 0) schedule = data;
    } catch {}

    const now = getAdjustedDate();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const coords = getValidCoords();
    if (!coords) return;
    const locationParam = `${coords.lon},${coords.lat}`;

    const daily3d = getValidDaily3d(locationParam);
    const hourly72h = getValidHourly72h(locationParam);

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const formatLocalDate = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const toDate = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      const d = getAdjustedDate();
      d.setHours(h, m, 0, 0);
      return d;
    };

    const buildDailyLine = (
      label: string,
      item?: { textDay?: string; textNight?: string; tempMin?: string; tempMax?: string }
    ) => {
      const day = item?.textDay || "--";
      const night = item?.textNight || "--";
      const tMin = item?.tempMin || "--";
      const tMax = item?.tempMax || "--";
      return `${label}：${day}/${night} ${tMin}~${tMax}°`;
    };

    const buildMorningLine = (label: string, targetDate: string) => {
      const list = hourly72h?.hourly || [];
      const segments = list
        .map((h) => {
          const ms = h.fxTime ? Date.parse(h.fxTime) : NaN;
          if (!Number.isFinite(ms)) return null;
          const d = new Date(ms);
          const dateStr = formatLocalDate(d);
          const hour = d.getHours();
          if (dateStr !== targetDate) return null;
          if (hour < 5 || hour > 8) return null;
          const timeText = `${pad2(hour)}:${pad2(d.getMinutes())}`;
          const tempText = h.temp ? `${h.temp}°` : "--";
          const popText = h.pop ? `${h.pop}%` : "--";
          const text = h.text || "--";
          return `${timeText} ${text} ${tempText} ${popText}`;
        })
        .filter(Boolean) as string[];
      return segments.length > 0 ? `${label}：${segments.join("　")}` : `${label}：--`;
    };

    for (const p of schedule) {
      const start = toDate(p.startTime);
      const end = toDate(p.endTime);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();

      if (nowMin >= endMin) {
        if (lastForecastPopupPeriodIdRef.current === p.id) {
          lastForecastPopupPeriodIdRef.current = null;
        }
        if (forecastPopupRef.current?.periodId === p.id) {
          window.dispatchEvent(
            new CustomEvent("messagePopup:close", {
              detail: { id: forecastPopupRef.current.popupId, dismiss: false },
            })
          );
          forecastPopupRef.current = null;
        }
      }

      if (nowMin >= startMin && nowMin < endMin && endMin - nowMin <= 5) {
        const alreadyPopped = lastForecastPopupPeriodIdRef.current === p.id;
        if (alreadyPopped) break;

        const tomorrow = daily3d?.daily?.[1];
        const dayAfter = daily3d?.daily?.[2];
        const dayAfterDate = String(dayAfter?.fxDate || "");
        const fallbackDayAfter = (() => {
          const d = getAdjustedDate();
          d.setDate(d.getDate() + 2);
          return formatLocalDate(d);
        })();
        const targetMorningDate = dayAfterDate || fallbackDayAfter;

        const message = (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div>{buildDailyLine("明天", tomorrow)}</div>
            <div>{buildDailyLine("后天", dayAfter)}</div>
            <div>{buildMorningLine("后天早上(5-8)", targetMorningDate)}</div>
          </div>
        );

        const popupId = `weather:classEndForecast:${p.id}:${formatLocalDate(now)}`;
        window.dispatchEvent(
          new CustomEvent("messagePopup:open", {
            detail: {
              id: popupId,
              type: "weatherForecast",
              title: "下课前天气预报",
              message,
            },
          })
        );
        lastForecastPopupPeriodIdRef.current = p.id;
        forecastPopupRef.current = { periodId: p.id, popupId };
        break;
      }
    }
  }, [currentTime, study.classEndForecastEnabled]);

  /** 工具函数：计算到指定日期的剩余天数（YYYY-MM-DD） */
  const calcDaysToDate = useCallback((dateStr?: string) => {
    if (!dateStr) return 0;
    const now = getAdjustedDate();
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return 0;
    const target = new Date(y, m - 1, d);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, []);

  /** 计算到最近一次高考（6月7日）的剩余天数（函数级注释：根据设置的目标年份计算到6月7日的剩余天数，返回非负整数） */
  const calcDaysToNextGaokao = useCallback(() => {
    const now = getAdjustedDate();
    const year = study.targetYear || now.getFullYear();
    const target = new Date(year, 5, 7);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [study.targetYear]);

  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  /** 构建轮播项（兼容旧配置） */
  const countdownItems: CountdownItem[] = (() => {
    const list = (study.countdownItems || []) as CountdownItem[];

    if (list && list.length > 0) {
      return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    // 兼容旧版：仅一个倒计时
    const isCustom = (study.countdownType ?? "gaokao") === "custom";
    if (isCustom && study.customDate) {
      return [
        {
          id: "legacy-custom",
          kind: "custom",
          name: study.customName || "自定义事件",
          targetDate: study.customDate,
          order: 0,
          bgColor: undefined,
          textColor: undefined,
        },
      ];
    }
    return [
      {
        id: "legacy-gaokao",
        kind: "gaokao",
        name: `高考倒计时`,
        order: 0,
        bgColor: undefined,
        textColor: undefined,
      },
    ];
  })();

  // 容器尺寸与宽度测量
  useEffect(() => {
    const measure = () => {
      const el = countdownRef.current;
      if (!el) {
        setItemHeight(0);
        return;
      }
      setItemHeight(el.clientHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [countdownItems.length, activeIndex]);

  // 自动轮播：按配置间隔切换
  useEffect(() => {
    const total = countdownItems.length;
    if (total <= 1) return;
    const intervalSec = Math.max(1, Math.min(60, study.carouselIntervalSec ?? 6));
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % total);
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [countdownItems.length, study.carouselIntervalSec]);

  // 背景样式移动到全局 ClockPage 中处理，为了自习模式卡片保留变量注入
  type ContainerStyle = React.CSSProperties & {
    ["--font-main"]?: string;
    ["--font-ui"]?: string;
  };
  const containerStyle: ContainerStyle = (() => {
    const style: ContainerStyle = {};
    if (study.numericFontFamily && study.numericFontFamily.trim().length > 0) {
      style["--font-main"] = study.numericFontFamily;
    }
    if (study.textFontFamily && study.textFontFamily.trim().length > 0) {
      style["--font-ui"] = study.textFontFamily;
    }
    return style;
  })();

  // 手动关闭报告：记录当前课时的关闭标记，避免在窗口内重复弹出
  const handleCloseReport = useCallback(() => {
    if (reportPeriod) {
      dismissedPeriodIdRef.current = reportPeriod.id;
    }
    setReportOpen(false);
  }, [reportPeriod]);

  /** 返回历史记录（函数级注释：仅在从历史记录进入报告时提供“返回历史记录”按钮，避免关闭按钮产生隐式跳转） */
  const handleBackToHistory = useCallback(() => {
    if (reportPeriod) {
      dismissedPeriodIdRef.current = reportPeriod.id;
    }
    setReportOpen(false);
    setHistoryOpen(true);
    setReportFromHistory(false);
  }, [reportPeriod]);

  const handleCloseHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  /**
   * 打开噪音历史记录（函数级注释：由噪音监测“呼吸灯”触发，进入历史记录管理界面）
   */
  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  /**
   * 从历史列表查看详情（函数级注释：关闭历史弹窗并打开报告弹窗，复用统一的统计报告 UI）
   */
  const handleViewHistoryDetail = useCallback((period: NoiseReportPeriod) => {
    setHistoryOpen(false);
    setReportPeriod(period);
    setReportOpen(true);
    setReportFromHistory(true); // 标记来源为历史记录
  }, []);

  const display = study.display || {
    showStatusBar: true,
    showNoiseMonitor: true,
    showCountdown: true,
    showQuote: true,
    showTime: true,
    showDate: true,
  };

  // 计算每个项的文案与天数（函数级注释：生成倒计时项的显示文本，其中高考事件强制包含年份并采用“距离YYYY高考仅xx天”的格式）
  const renderItem = (item: (typeof countdownItems)[number]) => {
    const days = item.kind === "gaokao" ? calcDaysToNextGaokao() : calcDaysToDate(item.targetDate);
    // 高考事件：优先从名称中解析年份，否则使用设置中的目标年份
    let nameText: string;
    if (item.kind === "gaokao") {
      const rawName = (item.name || "").trim();
      const m = rawName.match(/\b(19|20)\d{2}\b/); // 尝试从名称中提取四位年份
      const year = m ? parseInt(m[0], 10) : study.targetYear || getAdjustedDate().getFullYear();
      nameText = `${year}高考`;
    } else {
      nameText = item.name && item.name.trim().length > 0 ? item.name!.trim() : "自定义事件";
    }
    const textCol = item.textColor
      ? hexToRgba(item.textColor, typeof item.textOpacity === "number" ? item.textOpacity : 1)
      : undefined;
    const bgCol = item.bgColor
      ? hexToRgba(item.bgColor, typeof item.bgOpacity === "number" ? item.bgOpacity : 0)
      : undefined;
    const digitBaseColor = item.digitColor ?? study.digitColor;
    const digitAlpha =
      typeof item.digitOpacity === "number"
        ? item.digitOpacity
        : typeof study.digitOpacity === "number"
          ? study.digitOpacity
          : 1;
    const digitCol = digitBaseColor ? hexToRgba(digitBaseColor, digitAlpha) : undefined;
    return (
      <div
        key={item.id}
        className={styles.carouselItem}
        style={{
          color: textCol,
          backgroundColor: bgCol,
          borderRadius: item.bgColor ? 6 : undefined,
          padding: item.bgColor ? "0 8px" : undefined,
        }}
      >
        距离{nameText}仅{" "}
        <span className={styles.days} style={{ color: digitCol }}>
          {days}
        </span>{" "}
        天
      </div>
    );
  };

  const renderRightSidebarContent = () => {
    return (
      <div className={styles.widgetsColumn}>
        {display.showCountdown && (
          <div
            className={`${styles.widgetBox} ${study.cardStyleEnabled !== false ? styles.moduleCard : ""}`}
          >
            <div className={styles.countdownCarousel} ref={countdownRef} aria-live="polite">
              <div
                className={styles.carouselTrack}
                style={{ transform: `translateY(-${activeIndex * (itemHeight || 0)}px)` }}
              >
                {countdownItems.map(renderItem)}
              </div>
            </div>
          </div>
        )}

        {display.showNoiseMonitor && (
          <div
            className={`${styles.widgetBox} ${study.cardStyleEnabled !== false ? styles.moduleCard : ""}`}
          >
            <NoiseMonitor onStatusClick={handleOpenHistory} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container} style={containerStyle}>
      {/* 状态栏直接在容器中流动，由 flex 控制即可（需 CSS Module 中配置） */}
      {display.showStatusBar && <StudyStatus />}

      {/* 励志语录直接流式布局，放置在中心或合适位置 */}
      {display.showQuote && (
        <div className={styles.centerQuote}>
          <div className={styles.quoteSection}>
            <MotivationalQuote />
          </div>
        </div>
      )}

      {/* 如果获取到了 right-sidebar-slot，使用 Portal 注入右侧栏组件 */}
      {sidebarSlot && ReactDOM.createPortal(renderRightSidebarContent(), sidebarSlot)}

      {/* 当无法获取 Portal 锚点时的降级渲染 (针对纯色背景单独打开时的 fallback) */}
      {!sidebarSlot && <div className={styles.topBar}>{renderRightSidebarContent()}</div>}

      {/* 居中：时间始终显示，日期可隐藏 */}
      <div className={styles.centerTime}>
        <div
          className={styles.currentTime}
          style={study.timeColor ? { color: study.timeColor } : undefined}
        >
          {timeString}
        </div>
        {display.showDate && (
          <div
            className={styles.currentDate}
            style={study.dateColor ? { color: study.dateColor } : undefined}
          >
            {dateString}
          </div>
        )}
      </div>

      {/* 噪音报告弹窗 */}
      {reportOpen && reportPeriod && (
        <NoiseReportModal
          isOpen={reportOpen}
          onClose={handleCloseReport}
          onBack={reportFromHistory ? handleBackToHistory : undefined}
          period={reportPeriod}
        />
      )}

      {/* 噪音历史记录弹窗 */}
      {historyOpen && (
        <NoiseHistoryModal
          isOpen={historyOpen}
          onClose={handleCloseHistory}
          onViewDetail={handleViewHistoryDetail}
        />
      )}
    </div>
  );
}
