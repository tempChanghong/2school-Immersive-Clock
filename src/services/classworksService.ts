import type { HomeworkItem } from "../types/classworks";
import { getAppSettings } from "../utils/appSettings";

/**
 * 获取作业列表，直接按照原来对象的 key (例如 `["uid-2u3j-fs23", { name: "语文", content: "...", order: 1 }]`)
 * 转换为数组，并按 order 排序。由于项目现在移除了复杂的类型，所以只做通用的处理。
 */
export async function fetchHomeworkData(): Promise<HomeworkItem[]> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;
  const dataKey = "classworks-config-homework-today"; // 根据原版代码分析的默认存储今日作业的key，或者可以叫 'homework'

  if (!serverUrl || !namespace) {
    console.warn("Classworks KV variables are not set. Homework fetching is disabled.");
    return [];
  }

  try {
    const url = `${serverUrl.replace(/\/$/, '')}/kv/${namespace}/${dataKey}`;
    const headers: Record<string, string> = {
      "Accept": "application/json"
    };

    if (siteKey) {
      headers["x-site-key"] = siteKey;
      headers["x-app-token"] = siteKey; // 同时提供两种，以防不同的版本
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.info("No homework data found on server (404).");
        return [];
      }
      throw new Error(`Failed to fetch homework: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // 返回的数据格式原本是一个对象: { "UUID1": { name: "Subject", content: "...", order: 1, type: "normal" }, "UUID2": ... }
    const itemsArray: HomeworkItem[] = [];
    
    for (const key in data) {
      // 忽略可能存在的 success 标记等
      if (typeof data[key] === "object" && data[key] !== null && data[key].name) {
         itemsArray.push({
           key: key,
           ...data[key]
         });
      }
    }

    // 按照 order 排序
    return itemsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

  } catch (error) {
    console.error("Error fetching homework data:", error);
    return [];
  }
}
