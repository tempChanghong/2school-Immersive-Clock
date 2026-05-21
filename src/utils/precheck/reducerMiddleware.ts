/**
 * Reducer 中间件 - 在每次 dispatch 前后记录状态变化
 * 包装 appReducer，不改变纯函数语义，只在外层旁听
 */
import { AppState, AppAction } from "../../types";

import { createPrecheckLogger } from "./precheckLogger";

function getChangedPaths(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const paths: string[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    const pv = prev[key];
    const nv = next[key];
    if (pv !== nv) {
      if (typeof pv === "object" && typeof nv === "object" && pv !== null && nv !== null) {
        const nested = getChangedPaths(
          pv as Record<string, unknown>,
          nv as Record<string, unknown>
        );
        for (const nestedPath of nested) {
          paths.push(`${key}.${nestedPath}`);
        }
      } else {
        paths.push(key);
      }
    }
  }
  return paths;
}

export function withPrecheckMiddleware(
  reducer: (state: AppState, action: AppAction) => AppState
): (state: AppState, action: AppAction) => AppState {
  const log = createPrecheckLogger("Reducer");

  return (state, action) => {
    const prevState = { ...state } as unknown as Record<string, unknown>;

    const nextState = reducer(state, action);

    const nextStateObj = nextState as unknown as Record<string, unknown>;
    const changedPaths = getChangedPaths(prevState, nextStateObj);
    if (changedPaths.length > 0) {
      log.debug(`dispatch ${action.type}`, {
        actionType: action.type,
        changed: changedPaths,
        payload: "payload" in action ? (action as Record<string, unknown>).payload : undefined,
      });
    }

    return nextState;
  };
}
