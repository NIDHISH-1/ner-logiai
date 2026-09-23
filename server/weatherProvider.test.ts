import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWeatherCache, fetchLiveWeather, getWeatherCacheTtlMs, LIVE_WEATHER_DATA_LABEL } from "./weatherProvider";
import { WEATHER_DATA_LABEL } from "./riskEngine";

const fallback = {
  rainfallIntensity: 12,
  temperatureC: 24,
  floodWarning: false,
  landslideWarning: false,
  observedAt: new Date().toISOString(),
  dataLabel: WEATHER_DATA_LABEL,
} as const;

afterEach(() => {
  clearWeatherCache();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OpenWeather adapter", () => {
  it("maps a location-specific current weather response to live features", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ dt: 1_725_000_000, main: { temp: 23.4 }, weather: [{ main: "Rain" }], rain: { "1h": 18.5 } }), { status: 200 })));
    const result = await fetchLiveWeather({ latitude: 26.75, longitude: 94.2 }, fallback);
    expect(result.source).toBe(LIVE_WEATHER_DATA_LABEL);
    expect(result.dataLabel).toBe(LIVE_WEATHER_DATA_LABEL);
    expect(result.temperatureC).toBe(23.4);
    expect(result.rainfallIntensity).toBe(18.5);
    expect(result.observedAt).toBe(new Date(1_725_000_000 * 1000).toISOString());
    expect(result.providerRetrievedAt).toBe(result.cacheRetrievedAt);
  });

  it("reuses a recent response by coordinate without calling OpenWeather again", async () => {
    vi.stubEnv("OPENWEATHER_CACHE_TTL_SECONDS", "60");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ dt: 1_725_000_000, main: { temp: 23.4 }, weather: [{ main: "Clouds" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const coordinates = { latitude: 25.67, longitude: 94.1 };
    const first = await fetchLiveWeather(coordinates, fallback);
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = await fetchLiveWeather(coordinates, fallback);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.source).toBe(LIVE_WEATHER_DATA_LABEL);
    expect(second.observedAt).toBe(first.observedAt);
    expect(second.providerRetrievedAt).toBe(first.providerRetrievedAt);
    expect(new Date(second.cacheRetrievedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.cacheRetrievedAt).getTime());
    expect(getWeatherCacheTtlMs()).toBe(60_000);
  });

  it("refreshes after TTL expiry and keeps provider timestamp separate", async () => {
    vi.stubEnv("OPENWEATHER_CACHE_TTL_SECONDS", "10");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T00:00:00.000Z"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ dt: 1_725_000_000, main: { temp: 23.4 }, weather: [{ main: "Clouds" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dt: 1_725_000_060, main: { temp: 24.1 }, weather: [{ main: "Rain" }], rain: { "1h": 4 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const coordinates = { latitude: 25.58, longitude: 91.89 };
    const first = await fetchLiveWeather(coordinates, fallback);
    vi.advanceTimersByTime(10_001);
    const refreshed = await fetchLiveWeather(coordinates, fallback);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed.temperatureC).toBe(24.1);
    expect(refreshed.observedAt).not.toBe(first.observedAt);
  });

  it("falls back to clearly labeled simulated data when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    const result = await fetchLiveWeather({ latitude: 25.67, longitude: 94.1 }, fallback);
    expect(result.source).toBe(WEATHER_DATA_LABEL);
    expect(result.dataLabel).toBe(WEATHER_DATA_LABEL);
    expect(result.condition).toBe("Simulated fallback");
    expect(result.temperatureC).toBe(fallback.temperatureC);
  });

  it("does not serve expired cached data when a refresh fails", async () => {
    vi.stubEnv("OPENWEATHER_CACHE_TTL_SECONDS", "10");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ dt: 1_725_000_000, main: { temp: 23.4 }, weather: [{ main: "Clouds" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const coordinates = { latitude: 25.1, longitude: 91.7 };
    await fetchLiveWeather(coordinates, fallback);
    clearWeatherCache();
    const result = await fetchLiveWeather(coordinates, fallback);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe(WEATHER_DATA_LABEL);
    expect(result.temperatureC).toBe(fallback.temperatureC);
  });
});
