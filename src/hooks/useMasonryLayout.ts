import { useState, useEffect, useMemo, RefObject } from 'react';
import type { HomeworkItem } from '../types/classworks';

/**
 * 启发式估算单个作业卡片的展现"权重"（即近似高度比例）
 */
function estimateCardWeight(item: HomeworkItem): number {
  // 基础高度 (包括 Padding, Title 等)
  const BASE_WEIGHT = 70;
  
  // 对于特殊卡片（例如打卡/签到统计），固定一个较高的基础权重
  if (item.type === 'attendance') {
    return BASE_WEIGHT + 120;
  }
  
  if (item.type === 'exam') {
    return BASE_WEIGHT + 80;
  }

  // 默认文本卡片：计算内容的行数
  let contentWeight = 0;
  if (item.content) {
    const lines = item.content.split('\n');
    lines.forEach(line => {
      // 每行自身带一个权重（文字高度+边距）
      contentWeight += 25;
      
      // 这里的 25 也恰巧符合用户需求的 "每25个中文字符算作折行一次"
      const length = line.trim().length;
      if (length > 25) {
        contentWeight += Math.ceil(length / 25) * 20;
      }
    });
  } else {
    // 暂无作业状态的提示文本高度
    contentWeight += 30;
  }

  return BASE_WEIGHT + contentWeight;
}

/**
 * 动态瀑布流 Hook
 * @param containerRef 瀑布流的外层容器 Ref，用于 ResizeObserver 监听宽度
 * @param items 需要排列的所有作业项卡片
 * @returns 将 items 拆分为 N 列后的二维数组
 */
export function useMasonryLayout(
  containerRef: RefObject<HTMLElement>,
  items: HomeworkItem[]
): HomeworkItem[][] {
  const [columnsCount, setColumnsCount] = useState<number>(3); // 默认 3 列

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let debounceTimer: NodeJS.Timeout;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        let newCount = 2; // 默认最少 2 列
        
        if (width > 1200) {
          newCount = 4;
        } else if (width > 800) {
          newCount = 3;
        }

        // 仅在计算出的列数发生断点变化时，才触发状态更新
        setColumnsCount((prev) => {
          if (prev !== newCount) {
             return newCount;
          }
          return prev;
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(debounceTimer);
    };
  }, [containerRef]);

  // 依赖列数和数据源，进行贪心列分配
  const columns = useMemo(() => {
    const cols: HomeworkItem[][] = Array.from({ length: columnsCount }, () => []);
    const colWeights = new Array(columnsCount).fill(0);

    // 针对这批数据做一次贪心分配 (为了更好平衡，我们可以不重新排序从而保持业务原来给的顺序，仅仅做放置)
    // 通常 classworks 的 gridLayout.js 会做 LPT 排序来达到最优全局。但这里我们先顺着原来的业务顺序放，同时选择当前最短的列。（保留顺序视觉感更好控制科目顺序）
    
    items.forEach(item => {
      // 排除掉外部已经不要的类型，如 hitokoto
      if (item.type === 'hitokoto') return;

      const weight = estimateCardWeight(item);
      
      // 找出当前权重最小的列的索引
      let minIdx = 0;
      let minWeight = colWeights[0];
      for (let i = 1; i < columnsCount; i++) {
        if (colWeights[i] < minWeight) {
          minWeight = colWeights[i];
          minIdx = i;
        }
      }

      // 将该卡片推入最短列，并更新该列的权重
      cols[minIdx].push(item);
      colWeights[minIdx] += weight;
    });

    return cols;
  }, [items, columnsCount]);

  return columns;
}
