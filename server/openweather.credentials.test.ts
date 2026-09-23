import { describe, expect, it } from "vitest";

describe("OpenWeather credential", () => {
  it.runIf(Boolean(process.env.OPENWEATHER_API_KEY))("authenticates against the current-weather endpoint", async () => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    expect(apiKey, "OPENWEATHER_API_KEY must be configured").toBeTruthy();
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=26.1445&lon=91.7362&appid=${encodeURIComponent(apiKey ?? "")}&units=metric`, { signal: AbortSignal.timeout(15_000) });
    expect(response.ok, `OpenWeather returned HTTP ${response.status}`).toBe(true);
    const body = await response.json() as { main?: { temp?: number }; dt?: number; weather?: unknown[] };
    expect(typeof body.main?.temp).toBe("number");
    expect(typeof body.dt).toBe("number");
    expect(Array.isArray(body.weather)).toBe(true);
  }, 20_000);
});
