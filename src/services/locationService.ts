import type {
  AddressInfo,
  CityLookupResponse,
  Coords,
  GeolocationDiagnostics,
  GeolocationPermissionState,
  GeolocationResult,
} from "../types/weather";
import { getAppSettings } from "../utils/appSettings";
import {
  getValidCoords,
  getValidLocation,
  updateCoordsCache,
  updateGeolocationDiagnostics,
  updateLocationCache,
} from "../utils/weatherStorage";

import { httpGetJson } from "./httpClient";
import { qweatherGetJson } from "./qweatherClient";

export type {
  AddressInfo,
  CityLookupResponse,
  Coords,
  GeolocationDiagnostics,
  GeolocationPermissionState,
  GeolocationResult,
};

export type LocationFlowOptions = {
  preferredLocationMode?: "auto" | "manual";
  forceGeolocation?: boolean;
};

// 第三方响应类型声明
interface AmapIpResponse {
  status?: string;
  info?: string;
  rectangle?: string;
}

interface IpInfoResponse {
  loc?: string;
}

interface OsmAddress {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface OsmReverseResponse {
  address?: OsmAddress;
  display_name?: string;
}

interface AmapReverseResponse {
  status?: string;
  info?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      streetNumber?: { street?: string; number?: string };
      township?: string;
      district?: string;
      city?: string;
      province?: string;
    };
  };
}

// 已移除对 VITE_AMAP_API_KEY 的依赖与读取逻辑

/**
 * 获取浏览器定位权限状态
 * 检查浏览器是否支持定位权限查询，以及当前状态是否为已授权、拒绝或提示
 * @returns 定位权限状态（granted/denied/prompt/unsupported/unknown）
 */
async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  try {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) {
      return "unsupported";
    }
    const perms = navigator.permissions as unknown as {
      query: (d: { name: string }) => Promise<{ state?: string }>;
    };
    const status = await perms.query({ name: "geolocation" });
    const state = String(status?.state || "").toLowerCase();
    if (state === "granted" || state === "denied" || state === "prompt") return state;
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 通过浏览器原生 Geolocation API 获取坐标与诊断信息
 */
export async function getGeolocationResult(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<GeolocationResult> {
  const attemptedAt = Date.now();
  const isSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const isSecureContext = typeof window !== "undefined" ? Boolean(window.isSecureContext) : false;
  const permissionState = await getGeolocationPermissionState();

  const timeoutMs = options?.timeoutMs ?? 25000;
  const maximumAgeMs = options?.maximumAgeMs ?? 60 * 1000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;

  const baseDiagnostics: GeolocationDiagnostics = {
    isSupported,
    isSecureContext,
    permissionState,
    usedHighAccuracy: enableHighAccuracy,
    timeoutMs,
    maximumAgeMs,
    attemptedAt,
  };

  if (!isSupported || !isSecureContext) {
    return { coords: null, diagnostics: baseDiagnostics };
  }

  const runOnce = (cfg: {
    enableHighAccuracy: boolean;
    timeout: number;
    maximumAge: number;
  }): Promise<{ coords: Coords | null; error?: GeolocationPositionError }> => {
    return new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos?.coords?.latitude;
            const lon = pos?.coords?.longitude;
            if (typeof lat === "number" && typeof lon === "number") {
              resolve({ coords: { lat, lon } });
            } else {
              resolve({ coords: null });
            }
          },
          (err) => resolve({ coords: null, error: err }),
          cfg
        );
      } catch {
        resolve({ coords: null });
      }
    });
  };

  const first = await runOnce({
    enableHighAccuracy,
    timeout: timeoutMs,
    maximumAge: maximumAgeMs,
  });

  if (first.coords) {
    return { coords: first.coords, diagnostics: baseDiagnostics };
  }

  const firstErrCode = first.error?.code;
  const firstErrMessage = first.error?.message;

  if (firstErrCode === 1) {
    return {
      coords: null,
      diagnostics: { ...baseDiagnostics, errorCode: firstErrCode, errorMessage: firstErrMessage },
    };
  }

  if (enableHighAccuracy) {
    const second = await runOnce({
      enableHighAccuracy: false,
      timeout: Math.min(12000, timeoutMs),
      maximumAge: maximumAgeMs,
    });
    if (second.coords) {
      return {
        coords: second.coords,
        diagnostics: { ...baseDiagnostics, usedHighAccuracy: false },
      };
    }
    return {
      coords: null,
      diagnostics: {
        ...baseDiagnostics,
        usedHighAccuracy: false,
        errorCode: second.error?.code ?? firstErrCode,
        errorMessage: second.error?.message ?? firstErrMessage,
      },
    };
  }

  return {
    coords: null,
    diagnostics: { ...baseDiagnostics, errorCode: firstErrCode, errorMessage: firstErrMessage },
  };
}

/**
 * 通过浏览器原生 Geolocation API 获取坐标
 */
export async function getCoordsViaGeolocation(): Promise<Coords | null> {
  const result = await getGeolocationResult();
  return result.coords;
}

/**
 * 使用高德地图 IP 定位获取坐标
 * 失败返回 null
 */
export async function getCoordsViaAmapIP(): Promise<Coords | null> {
  // 专属版：直接跳过高德网络定位请求
  return null;
}

/**
 * 使用第三方 IP 服务获取坐标
 */
export async function getCoordsViaIP(): Promise<Coords | null> {
  const sources: Array<[string, string[]]> = [
    ["https://ipapi.co/json/", ["latitude", "longitude"]],
    ["https://ipinfo.io/json", ["loc"]],
  ];
  for (const [url, keys] of sources) {
    try {
      const data = (await httpGetJson(url)) as Record<string, unknown>;
      if (keys.length === 1 && keys[0] === "loc") {
        const loc = (data as IpInfoResponse)?.loc;
        if (loc && loc.includes(",")) {
          const [latStr, lonStr] = loc.split(",", 2);
          return { lat: parseFloat(latStr), lon: parseFloat(lonStr) };
        }
      } else {
        const latRaw = data[keys[0]];
        const lonRaw = data[keys[1]];
        const latNum =
          typeof latRaw === "number"
            ? latRaw
            : typeof latRaw === "string"
              ? parseFloat(latRaw)
              : NaN;
        const lonNum =
          typeof lonRaw === "number"
            ? lonRaw
            : typeof lonRaw === "string"
              ? parseFloat(lonRaw)
              : NaN;
        if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
          return { lat: latNum, lon: lonNum };
        }
      }
    } catch {
      // 继续尝试下一个数据源
    }
  }
  return null;
}

/**
 * 使用和风 GeoAPI 进行城市查询
 * 用于“手动城市名 → 经纬度”
 */
export async function fetchCityLookup(keyword: string): Promise<CityLookupResponse> {
  try {
    const data = await qweatherGetJson(
      `/geo/v2/city/lookup?location=${encodeURIComponent(keyword)}&lang=zh&number=5`
    );
    return data as CityLookupResponse;
  } catch (e: unknown) {
    return { error: String(e) } as CityLookupResponse;
  }
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * 校验经纬度是否合法
 */
function validateCoords(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * 从 AppSettings 的手动定位设置解析坐标
 */
async function resolveManualCoordsFromSettings(): Promise<
  { coords: Coords; coordsSource: string } | { coords: null; coordsSource: null }
> {
  try {
    const weather = getAppSettings().general.weather;
    if (weather.locationMode !== "manual") return { coords: null, coordsSource: null };
    const manual = weather.manualLocation;
    if (manual.type === "coords") {
      const lat = manual.lat;
      const lon = manual.lon;
      if (isFiniteNumber(lat) && isFiniteNumber(lon) && validateCoords(lat, lon)) {
        return { coords: { lat, lon }, coordsSource: "manual_coords" };
      }
      return { coords: null, coordsSource: null };
    }
    const cityName = String(manual.cityName || "").trim();
    if (!cityName) return { coords: null, coordsSource: null };
    const resp = await fetchCityLookup(cityName);
    const first = resp.location && resp.location.length > 0 ? resp.location[0] : null;
    const lat = first?.lat != null ? Number.parseFloat(String(first.lat)) : NaN;
    const lon = first?.lon != null ? Number.parseFloat(String(first.lon)) : NaN;
    if (validateCoords(lat, lon)) {
      return { coords: { lat, lon }, coordsSource: "manual_city" };
    }
    return { coords: null, coordsSource: null };
  } catch {
    return { coords: null, coordsSource: null };
  }
}

/**
 * 使用 OSM Nominatim 反向地理编码
 */
export async function reverseGeocodeOSM(lat: number, lon: number): Promise<AddressInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  try {
    const data = (await httpGetJson(url)) as OsmReverseResponse;
    const addr: OsmAddress = data?.address || {};
    const parts: string[] = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts.push(addr.house_number);
    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    else if (addr.suburb) parts.push(addr.suburb);
    const city = addr.city || addr.town || addr.village || addr.county;
    if (city) parts.push(city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    const formatted = parts.length ? parts.join(" ") : data?.display_name;
    return { address: formatted, raw: addr, source: "OSM" };
  } catch (e: unknown) {
    return { error: String(e), source: "OSM" } as AddressInfo;
  }
}

/**
 * 使用高德反向地理编码
 */
export async function reverseGeocodeAmap(lat: number, lon: number): Promise<AddressInfo> {
  // 专属版：固定返回天津市，不发起任何网络请求
  return { address: "天津市", source: "Amap", raw: { city: "天津市" } };
}

/**
 * 从高德反编码地址对象中提取城市名
 */
function extractCityFromAmapReverse(raw: unknown): string | null {
  const comp = raw as
    | NonNullable<AmapReverseResponse["regeocode"]>["addressComponent"]
    | null
    | undefined;
  const pickText = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) return item.trim();
      }
    }
    return null;
  };

  const city = pickText(comp?.city);
  if (city) return city;

  const district = pickText(comp?.district);
  if (district) return district;

  const province = pickText(comp?.province);
  if (province) return province;

  return null;
}

/**
 * 从 OSM 反向地理编码地址对象中提取城市名
 */
function extractCityFromOsmAddress(raw: unknown): string | null {
  const addr = raw as Partial<OsmAddress> | null | undefined;
  const city =
    addr?.city || addr?.town || addr?.village || addr?.county || addr?.state || addr?.country;
  if (typeof city === "string" && city.trim()) return city.trim();
  return null;
}

/**
 * 根据反向地理编码结果抽取城市名
 */
function extractCityFromAddressInfo(info: AddressInfo | null): string | null {
  if (!info) return null;
  if (info.source === "Amap") return extractCityFromAmapReverse(info.raw);
  if (info.source === "OSM") return extractCityFromOsmAddress(info.raw);
  return null;
}

/**
 * 获取坐标与地址信息并写入缓存
 * 优先级：手动定位 -> 缓存 -> 浏览器定位 -> IP 定位
 */
async function resolveCoordsAndLocation(options?: LocationFlowOptions): Promise<{
  coords: Coords | null;
  coordsSource: string | null;
  city: string | null;
  addressInfo: AddressInfo | null;
}> {
  // 专属版：强制硬编码位置为天津市
  const coords = { lat: 39.125, lon: 117.190 };
  const coordsSource = "hardcoded_tianjin";
  
  updateCoordsCache(coords.lat, coords.lon, coordsSource);

  const city = "天津市";
  const addressInfo: AddressInfo = {
    address: "天津市",
    source: "Hardcoded",
    raw: { city: "天津市" }
  };
  
  updateLocationCache(coords.lat, coords.lon, {
    city,
    address: addressInfo.address,
    addressSource: addressInfo.source,
  });

  return { coords, coordsSource, city, addressInfo };
}

/**
 * 构建位置获取流程
 * 更新并返回当前坐标、来源、城市及地址
 * @param options - 位置获取选项
 * @returns 包含坐标、来源、城市及地址信息的对象
 */
export async function buildLocationFlow(options?: LocationFlowOptions): Promise<{
  coords: Coords | null;
  coordsSource?: string | null;
  city?: string | null;
  addressInfo?: AddressInfo | null;
}> {
  const { coords, coordsSource, city, addressInfo } = await resolveCoordsAndLocation(options);
  return { coords, coordsSource, city, addressInfo };
}
