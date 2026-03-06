import type { NoiseFrameSample } from "../../types/noise";

export interface NoiseFrameProcessorOptions {
  analyser: AnalyserNode;
  frameMs: number;
  onFrame: (frame: NoiseFrameSample) => void;
}

export interface NoiseFrameProcessorController {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * 计算音频数据的 RMS (均方根) 和峰值
 * @param data 浮点音频采样数据
 * @returns 包含 RMS 和峰值的对象
 */
function computeRmsAndPeak(data: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const av = Math.abs(v);
    if (av > peak) peak = av;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, data.length));
  return { rms, peak };
}

/**
 * 将 RMS 转换为分贝 (dBFS)
 * @param rms 均方根值
 * @returns 分贝值，范围限制在 -100 到 0 dB
 */
function computeDbfsFromRms(rms: number): number {
  const safe = Math.max(1e-12, rms);
  const dbfs = 20 * Math.log10(safe);
  return Math.max(-100, Math.min(0, dbfs));
}

/**
 * 创建噪音帧处理器
 * @param options 配置选项
 * @returns 返回控制器对象 (start, stop, isRunning)
 */
export function createNoiseFrameProcessor(
  options: NoiseFrameProcessorOptions
): NoiseFrameProcessorController {
  const { analyser, onFrame } = options;
  const frameMs = Math.max(10, Math.round(options.frameMs));
  const timeBuffer = new Float32Array(analyser.fftSize);
  const freqBuffer = new Float32Array(analyser.frequencyBinCount);

  let timer: number | null = null;

  const tick = () => {
    // 1. 获取时域数据
    analyser.getFloatTimeDomainData(timeBuffer);
    const { rms: rawRms, peak } = computeRmsAndPeak(timeBuffer);

    // 2. 获取频域数据并应用人声过滤降权
    analyser.getFloatFrequencyData(freqBuffer);
    const sampleRate = analyser.context.sampleRate;
    const binSize = sampleRate / analyser.fftSize;

    // 人声核心频段定位 (300Hz ~ 3000Hz)
    const voiceStartBin = Math.floor(300 / binSize);
    const voiceEndBin = Math.ceil(3000 / binSize);

    let totalEnergy = 0;
    let voiceEnergy = 0;

    // 遍历频域（线性级数求和计算能量）
    for (let i = 0; i < freqBuffer.length; i++) {
      const db = freqBuffer[i];
      // 将 dB 转换为近似的线性数值，去除负无穷
      const energy = db > -120 ? Math.pow(10, db / 10) : 0;
      totalEnergy += energy;

      if (i >= voiceStartBin && i <= voiceEndBin) {
        voiceEnergy += energy;
      }
    }

    let finalRms = rawRms;
    if (totalEnergy > 0) {
      const voiceRatio = voiceEnergy / totalEnergy;
      // 降权因子：当人声频段能量占比极低（不足 50%）时，强制削减最终生成的 RMS
      // 避免掉笔、环境极低频机箱轰鸣的高宽带能量拉响警报
      const penalty = Math.min(1, voiceRatio * 2);
      finalRms *= penalty;
    }

    const dbfs = computeDbfsFromRms(finalRms);
    onFrame({ t: Date.now(), rms: finalRms, dbfs, peak });
  };

  const start = () => {
    if (timer !== null) return;
    timer = window.setInterval(tick, frameMs);
  };

  const stop = () => {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  };

  return {
    start,
    stop,
    isRunning: () => timer !== null,
  };
}
