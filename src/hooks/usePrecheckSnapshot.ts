/**
 * 组件挂载时记录初始状态快照
 * 用于预检系统在组件生命周期关键节点自动记录状态
 */
import { useEffect, useRef } from "react";

import { createPrecheckLogger } from "../utils/precheck/precheckLogger";

export function usePrecheckSnapshot(
  componentName: string,
  stateSnapshot: Record<string, unknown>
): void {
  const log = useRef(createPrecheckLogger(`Component.${componentName}`));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    log.current.debug("组件状态更新", { snapshot: { ...stateSnapshot } });
  });

  useEffect(() => {
    log.current.info("组件挂载", {
      snapshot: { ...stateSnapshot },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
