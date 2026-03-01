import { driver, type Driver, type PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";

import { AppMode } from "../types";

const TOUR_STORAGE_KEY = "immersive-clock:has-seen-tour";

let currentDriver: Driver | null = null;

/**
 * 判断引导弹窗按钮是否“可作为默认焦点”的目标
 */
const isTourButtonUsable = (button?: HTMLButtonElement | null) => {
  if (!button) return false;
  if (button.disabled) return false;
  if (button.style.display === "none") return false;

  const rect = button.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
};

/**
 * 以微任务方式执行回调（优先使用 queueMicrotask，避免可见的 UI 闪烁）
 */
const scheduleMicrotask = (callback: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
};

/**
 * 多次尝试聚焦按钮（函数级注释：规避 driver.js 内部异步聚焦导致焦点落在“上一步/关闭”上的竞态）
 */
const focusButtonWithRetries = (button: HTMLButtonElement, retries = 3) => {
  let remaining = Math.max(0, retries);

  const tryFocusOnce = () => {
    if (remaining <= 0) return;
    remaining -= 1;

    if (!button.isConnected) return;
    if (button.disabled) return;

    const rect = button.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    button.focus();
    if (document.activeElement === button) return;

    setTimeout(tryFocusOnce, 60);
  };

  scheduleMicrotask(tryFocusOnce);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(tryFocusOnce);
  }
  setTimeout(tryFocusOnce, 0);
};

/**
  desc.textContent = current ? `${current} ${hint}` : hint;
};

/**
 * 手动添加关闭按钮（因为 allowClose: false 禁用了所有关闭方式，需手动补回按钮以仅允许按钮退出）
 */
const ensureCloseButton = (popover: PopoverDOM, driver: Driver) => {
  if (!popover.wrapper) {
    return;
  }

  if (popover.wrapper.querySelector(".driver-popover-close-btn")) {
    return;
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "driver-popover-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "退出指引";
  closeBtn.onclick = () => {
    driver.destroy();
  };

  popover.wrapper.appendChild(closeBtn);
};

/**
 * 让引导弹窗默认焦点落在“下一步”，而不是“上一步”或“X”
 */
const preferTourNextButtonAsDefaultFocus = (popover: PopoverDOM, opts: { driver: Driver }) => {
  // 确保关闭按钮存在（因为 allowClose: false）
  ensureCloseButton(popover, opts.driver);

  if (!opts.driver.isActive()) return;

  const canNext = isTourButtonUsable(popover.nextButton);
  const canPrev = isTourButtonUsable(popover.previousButton);

  if (canNext) {
    if (popover.nextButton) focusButtonWithRetries(popover.nextButton, 4);
    return;
  }

  if (canPrev) {
    if (popover.previousButton) focusButtonWithRetries(popover.previousButton, 3);
  }
};

/**
 * 检查用户是否已观看过指引
 */
export const hasSeenTour = () => {
  return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
};

/**
 * 标记指引为已观看
 */
export const markTourAsSeen = () => {
  localStorage.setItem(TOUR_STORAGE_KEY, "true");
};

/**
 * 检查指引是否正在运行
 */
export const isTourActive = () => {
  return currentDriver ? currentDriver.isActive() : false;
};

interface TourOptions {
  onStart?: () => void;
  switchMode?: (mode: AppMode) => void;
  openSettings?: () => void;
  onEnd?: () => void;
}

/**
 * 启动新手指引
 * @param force 是否强制启动（忽略已观看状态）
 * @param options 配置选项
 */
export const startTour = (force = false, options?: TourOptions) => {
  if (!force && hasSeenTour()) {
    return;
  }

  let isDoneClicked = false;

  // 自动切换到 self-study 模式并展开 HUD 以确保能找到元素
  options?.switchMode?.("study");

  // 指引开始时立即执行回调（显示 HUD）
  options?.onStart?.();

  // 派发全局事件通知指引开始
  window.dispatchEvent(new Event("tour:start"));

  const driverObj = driver({
    showProgress: true,
    allowClose: false,
    allowKeyboardControl: false,
    animate: true,
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    doneBtnText: "完成",
    onPopoverRender: (popover, opts) => {
      preferTourNextButtonAsDefaultFocus(popover, { driver: opts.driver });
    },
    steps: [
      {
        popover: {
          title: "欢迎来到沉浸式班级一体机",
          description:
            "在开始使用之前，让我们花 1 分钟快速了解全新 Grid 布局中的各项核心功能。点击“下一步”继续。",
          side: "left",
          align: "center",
          showButtons: ["next"],
        },
      },
      {
        element: '[data-tour="clock-area"]',
        popover: {
          title: "沉浸式时钟主体",
          description:
            "这是班级大屏的核心视区。用于展示当前时间、日期以及自习状态。同时支持励志语录的轮播展示。",
          side: "top",
          align: "center",
        },
      },
      {
        element: '[data-tour="homework-board"]',
        popover: {
          title: "作业与通知板",
          description: "在这里可以记录各科作业与班级通知。支持点击上方按钮展开详情列表或同步刷新。",
          side: "right",
          align: "start",
        },
      },
      {
        element: '[data-tour="noise-monitor"]',
        popover: {
          title: "环境噪音监控",
          description:
            "实时监测教室麦克风的噪音分贝，当班级过吵时可触发视觉或听觉警报，帮助维持课堂纪律。",
          side: "left",
          align: "center",
        },
      },
      {
        element: '[data-tour="countdown-widget"]',
        popover: {
          title: "倒计时与测验工具",
          description: "在这里你可以配置距离中高考的倒数天数，还可以自定义倒计时。",
          side: "left",
          align: "center",
        },
      },
      {
        element: '[data-tour="hud-header"]',
        popover: {
          title: "全局控制与深度偏好",
          description:
            "顶部悬浮栏可用于随时切换“时钟/自习/倒计时”模式。",
          side: "bottom",
          align: "center",
        },
      },
      {
        popover: {
          title: "引导完成",
          description: "准备就绪！现在就开始打造专属你们班级的沉浸式大屏吧。",
          side: "left",
          align: "center",
          onNextClick: (_el, _step, opts) => {
            isDoneClicked = true;
            opts.driver.destroy();
          },
        },
      },
    ],
    onDestroyed: () => {
      markTourAsSeen();
      currentDriver = null;
      options?.onEnd?.();
      if (isDoneClicked) {
        window.dispatchEvent(new Event("tour:completed"));
      }
      // 派发全局事件通知指引结束
      window.dispatchEvent(new Event("tour:end"));
    },
  });

  currentDriver = driverObj;
  driverObj.drive();
};
