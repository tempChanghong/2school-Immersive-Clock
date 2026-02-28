import type {
  AddressInfo,
  AirQualityCurrentResponse,
  AstronomySunResponse,
  CityLookupResponse,
  Coords,
  GeolocationDiagnostics,
  GeolocationPermissionState,
  GeolocationResult,
  MinutelyPrecipResponse,
  WeatherHourly72hResponse,
  WeatherAlertResponse,
  WeatherDaily3dResponse,
  WeatherNow,
} from "../types/weather";

import { buildLocationFlow, type LocationFlowOptions } from "./locationService";

export type {
  AddressInfo,
  AirQualityCurrentResponse,
  AstronomySunResponse,
  CityLookupResponse,
  Coords,
  GeolocationDiagnostics,
  GeolocationPermissionState,
  GeolocationResult,
  MinutelyPrecipResponse,
  LocationFlowOptions,
  WeatherHourly72hResponse,
  WeatherAlertResponse,
  WeatherDaily3dResponse,
  WeatherNow,
};

export {
  buildLocationFlow,
  fetchCityLookup,
  getCoordsViaAmapIP,
  getCoordsViaGeolocation,
  getCoordsViaIP,
  getGeolocationResult,
  reverseGeocodeAmap,
  reverseGeocodeOSM,
} from "./locationService";

export interface WeatherFlowOptions extends LocationFlowOptions {
  fetchDaily3d?: boolean;
  fetchAstronomySun?: boolean;
  fetchAirQuality?: boolean;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
    weather_code: number;
  };
  error?: boolean;
  reason?: string;
}

/**
 * 状态码映射 (WMO 转换)
 * 将 Open-Meteo WMO 天气代码转换为项目内的 SVG 图标名称和中文文本
 */
function mapWmoToIconAndText(wmoCode: number): { icon: string; text: string } {
  // 0: Clear sky
  if (wmoCode === 0) return { icon: "01d", text: "晴" };
  // 1: Mainly clear
  if (wmoCode === 1) return { icon: "02d", text: "晴转多云" };
  // 2: Partly cloudy
  if (wmoCode === 2) return { icon: "03d", text: "多云" };
  // 3: Overcast
  if (wmoCode === 3) return { icon: "04d", text: "阴" };
  // 45, 48: Fog
  if (wmoCode === 45 || wmoCode === 48) return { icon: "50d", text: "雾" };
  // 51, 53, 55, 56, 57: Drizzle
  if ([51, 53, 55, 56, 57].includes(wmoCode)) return { icon: "09d", text: "毛毛雨" };
  // 61, 63, 65, 66, 67: Rain
  if ([61, 63, 65, 66, 67].includes(wmoCode)) return { icon: "10d", text: "雨" };
  // 71, 73, 75, 77: Snow
  if ([71, 73, 75, 77].includes(wmoCode)) return { icon: "13d", text: "雪" };
  // 80, 81, 82: Showers
  if ([80, 81, 82].includes(wmoCode)) return { icon: "09d", text: "阵雨" };
  // 85, 86: Snow showers
  if ([85, 86].includes(wmoCode)) return { icon: "13d", text: "阵雪" };
  // 95, 96, 99: Thunderstorm
  if ([95, 96, 99].includes(wmoCode)) return { icon: "11d", text: "雷阵雨" };

  return { icon: "01d", text: "未知" };
}

/**
 * 获取实时天气 (基于 Open-Meteo，硬编码天津坐标)
 */
export async function fetchWeatherNow(_location: string): Promise<WeatherNow> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=39.125&longitude=117.19&current=temperature_2m,weather_code";
    const res = await fetch(url);
    if (!res.ok) {
      return { error: `HTTP Error: ${res.status}` } as WeatherNow;
    }
    const data = (await res.json()) as OpenMeteoResponse;
    if (data.error || !data.current) {
      return { error: data.reason || "Failed to parse Open-Meteo response" } as WeatherNow;
    }

    const { temperature_2m, weather_code } = data.current;
    const { icon, text } = mapWmoToIconAndText(weather_code);

    return {
      code: "200",
      now: {
        obsTime: new Date().toISOString(),
        temp: String(Math.round(temperature_2m)),
        icon,
        text,
        feelsLike: String(Math.round(temperature_2m)),
        wind360: "0",
        windDir: "北风",
        windScale: "1",
        windSpeed: "0",
        humidity: "50",
        pressure: "1013",
        precip: "0",
        vis: "10",
        cloud: "0",
        dew: "0",
      },
      refer: {
        sources: ["Open-Meteo"],
        license: [],
      },
    };
  } catch (e: unknown) {
    return { error: String(e) } as WeatherNow;
  }
}

/**
 * 获取三日天气预报 (不适用 - 直接返回空结构)
 */
export async function fetchWeatherDaily3d(_location: string): Promise<WeatherDaily3dResponse> {
  return { code: "200", daily: [] };
}

/**
 * 获取日出日落时间 (不适用 - 直接返回空结构)
 */
export async function fetchAstronomySun(
  _location: string,
  _date: string
): Promise<AstronomySunResponse> {
  return { code: "200", sunrise: "", sunset: "" };
}

/**
 * 获取空气质量 (不适用 - 直接返回空结构)
 */
export async function fetchAirQualityCurrent(
  _lat: number,
  _lon: number
): Promise<AirQualityCurrentResponse> {
  return {
    error: "Air quality not supported with Open-Meteo currently",
  } as AirQualityCurrentResponse;
}

/**
 * 获取指定坐标的天气预警 (不适用 - 直接返回空结构)
 */
export async function fetchWeatherAlertsByCoords(
  _lat: number,
  _lon: number
): Promise<WeatherAlertResponse> {
  return { metadata: { zeroResult: true }, alerts: [] };
}

/**
 * 获取分钟级降水 (不适用 - 直接返回空结构)
 */
export async function fetchMinutelyPrecip(_location: string): Promise<MinutelyPrecipResponse> {
  return { code: "200", summary: "无降水", minutely: [] };
}

export async function fetchWeatherHourly72h(_location: string): Promise<WeatherHourly72hResponse> {
  return { code: "200", hourly: [] };
}

/**
 * 构建天气数据获取流程
 * 仅保留 Open-Meteo 的当前天气能力
 */
export async function buildWeatherFlow(options?: WeatherFlowOptions): Promise<{
  coords: Coords | null;
  coordsSource?: string | null;
  city?: string | null;
  addressInfo?: AddressInfo | null;
  weather?: WeatherNow | null;
  daily3d?: WeatherDaily3dResponse | null;
  airQuality?: AirQualityCurrentResponse | null;
  astronomySun?: AstronomySunResponse | null;
}> {
  const loc = await buildLocationFlow(options);
  if (!loc.coords) {
    return { coords: null, coordsSource: null };
  }

  // 专属版：仅调用现有的 fetchWeatherNow
  const weather = await fetchWeatherNow("");

  let daily3d: WeatherDaily3dResponse | null = null;
  if (options?.fetchDaily3d !== false) {
    daily3d = await fetchWeatherDaily3d("");
  }

  let astronomySun: AstronomySunResponse | null = null;
  if (options?.fetchAstronomySun !== false) {
    astronomySun = await fetchAstronomySun("", "");
  }

  let airQuality: AirQualityCurrentResponse | null = null;
  if (options?.fetchAirQuality !== false) {
    airQuality = await fetchAirQualityCurrent(loc.coords.lat, loc.coords.lon);
  }

  return {
    coords: loc.coords,
    coordsSource: loc.coordsSource,
    city: loc.city,
    addressInfo: loc.addressInfo,
    weather,
    daily3d,
    astronomySun,
    airQuality,
  };
}
