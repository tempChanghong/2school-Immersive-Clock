import type { HomeworkItem } from "../types/classworks";
import { getAppSettings } from "../utils/appSettings";

/**
 * 格式化今天的日期为 YYYYMMDD
 */
export function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * 构造请求头
 * 根据 Classworks KV 文档，使用 X-Site-Key 进行认证（如果设置了密码/Token）
 */
function buildHeaders(siteKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  
  if (siteKey) {
    // 为了防止 fetch 因为中文字符导致 "String contains non ISO-8859-1 code point" 报错
    // 我们强制对其进行 URI 编码。标准的 Token 和 UUID 应当全是 ASCII。
    headers["X-Site-Key"] = encodeURIComponent(siteKey);
  }
  
  return headers;
}

/**
 * 获取作业列表，按照给定格式解析
 */
export async function fetchHomeworkData(): Promise<HomeworkItem[]> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;

  if (!cwConfig.enabled || !serverUrl || !namespace) {
    return [];
  }

  const dateStr = getTodayDateString();
  const dataKey = `classworks-data-${dateStr}`;

  try {
    const url = `${serverUrl.replace(/\/$/, '')}/kv/${encodeURIComponent(namespace)}/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.info(`No homework data found for today (${dataKey}).`);
        return [];
      }
      throw new Error(`Failed to fetch homework: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const itemsArray: HomeworkItem[] = [];

    // Fetch the data. It contains "homework" and "attendance" properties
    if (data && data.homework && typeof data.homework === "object") {
      let defaultOrder = 100;
      for (const subject in data.homework) {
        const itemObj = data.homework[subject];
        if (itemObj && typeof itemObj.content === "string" && itemObj.content.trim() !== "") {
          itemsArray.push({
            key: subject,
            name: itemObj.name || subject,
            content: itemObj.content,
            order: typeof itemObj.order === "number" ? itemObj.order : defaultOrder++,
            type: itemObj.type || "normal",
            ...itemObj // Collect any other properties safely
          });
        }
      }
    }

    return itemsArray;
  } catch (error) {
    console.error("Error fetching homework data:", error);
    return [];
  }
}

/**
 * 测试作业板连通性
 */
export async function testHomeworkConnection(
  serverUrl: string,
  namespace: string,
  siteKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const dateStr = getTodayDateString();
    const dataKey = `classworks-data-${dateStr}`;
    const url = `${serverUrl.replace(/\/$/, '')}/kv/${encodeURIComponent(namespace)}/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, { headers });

    // 只要能正常连上服务器并且返回业务状态码（包括 404 找不到该命名空间/键），都可以认为连接成功
    if (!response.ok) {
      if (response.status === 404) {
        return { success: true }; // 连上了，只是没有数据
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "认证失败，请检查密码/Token是否正确" };
      }
      return { success: false, error: `服务器返回错误: ${response.status} ${response.statusText}` };
    }

    return { success: true };
  } catch (error: any) {
    if (error.message && error.message.includes("ISO-8859-1")) {
      return { success: false, error: "Token 或 命名空间 中包含不支持的中文字符，请使用拼音或标准的 UUID" };
    }
    return { success: false, error: error.message || "网络请求失败，请检查服务端地址" };
  }
}

/**
 * 获取作业板完整的原始数据
 */
export async function fetchRawClassworksData(dateStr?: string): Promise<any> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;

  if (!cwConfig.enabled || !serverUrl || !namespace) {
    return null;
  }

  const dateToFetch = dateStr || getTodayDateString();
  const dataKey = `classworks-data-${dateToFetch}`;

  try {
    const url = `${serverUrl.replace(/\/$/, "")}/kv/${encodeURIComponent(namespace)}/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch raw homework: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching raw homework data:", error);
    return null;
  }
}

/**
 * 保存作业板原始数据
 */
export async function saveClassworksData(dateStr: string, data: any): Promise<boolean> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;

  if (!cwConfig.enabled || !serverUrl || !namespace) {
    console.warn("Classworks save aborted (disabled or missing config).");
    return false;
  }

  const dataKey = `classworks-data-${dateStr}`;

  try {
    const url = `${serverUrl.replace(/\/$/, "")}/kv/${encodeURIComponent(namespace)}/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to save homework data: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error saving classworks data:", error);
    return false;
  }
}

/**
 * 更新单科作业
 */
export async function updateHomeworkItem(dateStr: string, key: string, newContent: string): Promise<boolean> {
  const rawData = await fetchRawClassworksData(dateStr);
  if (!rawData) {
    console.warn("Failed to update homework item: raw data not found");
    return false;
  }

  if (!rawData.homework) {
    rawData.homework = {};
  }

  if (rawData.homework[key]) {
    rawData.homework[key].content = newContent;
  } else {
    rawData.homework[key] = {
      name: key,
      content: newContent,
      type: "normal",
      order: Object.keys(rawData.homework).length + 100,
    };
  }

  return await saveClassworksData(dateStr, rawData);
}


