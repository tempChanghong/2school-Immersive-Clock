import type { Config, Driver, DriveStep, State } from "driver.js";
import { describe, expect, it, vi, afterEach } from "vitest";

const createDriverMockImpl = (): Driver => ({
  isActive: () => false,
  drive: vi.fn(),
  refresh: vi.fn(),
  setConfig: vi.fn(),
  setSteps: vi.fn(),
  getConfig: vi.fn(),
  getState: vi.fn(),
  getActiveIndex: vi.fn(),
  isFirstStep: vi.fn(),
  isLastStep: vi.fn(),
  getActiveStep: vi.fn(),
  getActiveElement: vi.fn(),
  getPreviousElement: vi.fn(),
  getPreviousStep: vi.fn(),
  moveNext: vi.fn(),
  movePrevious: vi.fn(),
  moveTo: vi.fn(),
  hasNextStep: vi.fn(),
  hasPreviousStep: vi.fn(),
  highlight: vi.fn(),
  destroy: vi.fn(),
});

const driverMock = vi.fn<[Config?], Driver>(() => createDriverMockImpl());

vi.mock("driver.js", async () => {
  const actual = await vi.importActual<typeof import("driver.js")>("driver.js");
  return {
    ...actual,
    driver: driverMock,
  };
});

describe("tour 守卫式下一步", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("全局禁用键盘切步", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config | undefined;
    expect(config?.allowKeyboardControl).toBe(false);
  });

  it("完成最后一步时会派发 tour:completed 事件", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const completedListener = vi.fn();
    window.addEventListener("tour:completed", completedListener);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const driverInstance = driverMock.mock.results[0]?.value as Driver;

    const steps = Array.isArray(config.steps) ? config.steps : [];
    const lastStep = steps[steps.length - 1];

    // 模拟点击最后一步的完成按钮
    lastStep.popover!.onNextClick!(undefined, lastStep as DriveStep, {
      config,
      state: {} as State,
      driver: driverInstance,
    });

    // 模拟 destroy 触发 onDestroyed
    config.onDestroyed?.(undefined, lastStep as DriveStep, {
      config,
      state: {} as State,
      driver: driverInstance,
    });

    expect(driverInstance.destroy).toHaveBeenCalled();
    expect(completedListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("tour:completed", completedListener);
  });

  it("未完成最后一步结束时不会派发 tour:completed 事件", async () => {
    driverMock.mockClear();
    localStorage.clear();

    const completedListener = vi.fn();
    window.addEventListener("tour:completed", completedListener);

    const { startTour } = await import("../tour");
    startTour(true);

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const driverInstance = driverMock.mock.results[0]?.value as Driver;

    const steps = Array.isArray(config.steps) ? config.steps : [];
    const someStep = steps[2];

    // 直接调用 onDestroyed（模拟非完成状态下的销毁）
    config.onDestroyed?.(undefined, someStep as DriveStep, {
      config,
      state: { activeIndex: 2 } as State,
      driver: driverInstance,
    });

    expect(completedListener).toHaveBeenCalledTimes(0);

    window.removeEventListener("tour:completed", completedListener);
  });
});
