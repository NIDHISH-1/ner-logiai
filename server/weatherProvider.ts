import { LIVE_WEATHER_DATA_LABEL, WEATHER_DATA_LABEL, type WeatherFeatures } from "./riskEngine";
export { LIVE_WEATHER_DATA_LABEL } from "./riskEngine";

export type WeatherSourceLabel = typeof LIVE_WEATHER_DATA_LABEL | typeof WEATHER_DATA_LABEL;

type Coordinates = { latitude: number; longitude: number };
type OpenWeatherResponse = {
  dt?: number;
  main?: { temp?: number };
  weather?: Array<{ main?: string; description?: string }>;
  rain?: { "1h"?: number; "3h"?: number };
  snow?: { "1h"?: number; "3h"?: number };
};

export type WeatherProviderResult = WeatherFeatures & {
  source: WeatherSourceLabel;
  condition: string;
  providerRetrievedAt: string;
  cacheRetrievedAt: string;
};

type CachedWeather = {
  weather: WeatherProviderResult;
  cachedAtMs: number;
};

export const DEFAULT_WEATHER_CACHE_TTL_SECONDS = 300;
const weatherCache = new Map<string, CachedWeather>();

export function getWeatherCacheTtlMs() {
  const configuredSeconds = Number(process.env.OPENWEATHER_CACHE_TTL_SECONDS ?? DEFAULT_WEATHER_CACHE_TTL_SECONDS);
  const seconds = Number.isFinite(configuredSeconds) ? Math.min(3600, Math.max(10, configuredSeconds)) : DEFAULT_WEATHER_CACHE_TTL_SECONDS;
  return seconds * 1000;
}

export function clearWeatherCache() {
  weatherCache.clear();
}

const cacheKey = (coordinates: Coordinates) => `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`;

const simulated = (weather: WeatherFeatures): WeatherProviderResult => {
  const now = new Date().toISOString();
  return {
    ...weather,
    source: WEATHER_DATA_LABEL,
    condition: "Simulated fallback",
    providerRetrievedAt: now,
    cacheRetrievedAt: now,
  };
};

function derivedWarnings(rainfallIntensity: number, condition: string) {
  const normalized = condition.toLowerCase();
  const intense = rainfallIntensity >= 20 || normalized.includes("thunderstorm");
  return {
    floodWarning: rainfallIntensity >= 30 || normalized.includes("flood"),
    landslideWarning: intense && (rainfallIntensity >= 20 || normalized.includes("thunderstorm")),
  };
}

export async function fetchLiveWeather(coordinates: Coordinates, fallback: WeatherFeatures): Promise<WeatherProviderResult> {
  const now = new Date().toISOString();
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return simulated(fallback);

  const key = cacheKey(coordinates);
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.cachedAtMs < getWeatherCacheTtlMs()) {
    return { ...cached.weather, cacheRetrievedAt: now };
  }
  if (cached) weatherCache.delete(key);

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", coordinates.latitude.toFixed(6));
    url.searchParams.set("lon", coordinates.longitude.toFixed(6));
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", "metric");
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`OpenWeather HTTP ${response.status}`);
    const payload = await response.json() as OpenWeatherResponse;
    const temperatureC = payload.main?.temp;
    const observedAt = payload.dt;
    const condition = payload.weather?.[0]?.main ?? payload.weather?.[0]?.description ?? "Unknown";
    const rainfallIntensity = Math.max(0, (payload.rain?.["1h"] ?? payload.rain?.["3h"] ?? 0) + (payload.snow?.["1h"] ?? 0));
    if (!Number.isFinite(temperatureC) || !Number.isFinite(observedAt)) throw new Error("OpenWeather response missing required fields");
    const warnings = derivedWarnings(rainfallIntensity, condition);
    const result: WeatherProviderResult = {
      rainfallIntensity,
      temperatureC: temperatureC as number,
      ...warnings,
      observedAt: new Date((observedAt as number) * 1000).toISOString(),
      dataLabel: LIVE_WEATHER_DATA_LABEL,
      source: LIVE_WEATHER_DATA_LABEL,
      condition,
      providerRetrievedAt: now,
      cacheRetrievedAt: now,
    };
    weatherCache.set(key, { weather: result, cachedAtMs: Date.now() });
    return result;
  } catch (error) {
    console.warn("[Weather] Live provider unavailable; using simulated fallback.", error instanceof Error ? error.message : "unknown error");
    return simulated(fallback);
  }
}

export const corridorCoordinates: Record<string, Coordinates> = {
  "NH-37-JORHAT": { latitude: 26.750000, longitude: 94.200000 },
  "NH-2-KOHIMA": { latitude: 25.674700, longitude: 94.108600 },
  "NH-6-SHILLONG": { latitude: 25.578800, longitude: 91.893300 },
};
