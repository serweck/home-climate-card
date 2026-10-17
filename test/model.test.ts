import { describe, it, expect } from "vitest";
import {
  DEFAULT_COMFORT, DEFAULT_THRESHOLDS, buildRoomView, formatHumidity, formatTemp, levelFor, parseHistory, roomAlerts, sparkline, trend,
} from "../src/model";
import { makeHass, st, PISCINA, SALON } from "./fixtures";

const H = 3_600_000;
const NOW = Date.parse("2026-10-17T15:00:00Z");

describe("formato", () => {
  it("temperatura con coma y una cifra, humedad entera", () => {
    expect(formatTemp(24.05)).toBe("24,1°");
    expect(formatTemp(-3)).toBe("−3,0°");
    expect(formatTemp(null)).toBe("—");
    expect(formatHumidity(50.6)).toBe("51 %");
    expect(formatHumidity(null)).toBe("—");
  });
});

describe("levelFor", () => {
  it("frío, confort, calor y mucho calor con los límites por defecto (19, 25, 28)", () => {
    expect(DEFAULT_COMFORT).toEqual({ cold: 19, warm: 25, hot: 28 });
    expect(levelFor(18.9, DEFAULT_COMFORT)).toBe("cold");
    expect(levelFor(19, DEFAULT_COMFORT)).toBe("comfort");
    expect(levelFor(25, DEFAULT_COMFORT)).toBe("comfort");
    expect(levelFor(25.1, DEFAULT_COMFORT)).toBe("warm");
    expect(levelFor(28.1, DEFAULT_COMFORT)).toBe("hot");
    expect(levelFor(null, DEFAULT_COMFORT)).toBe("unknown");
  });
});

describe("roomAlerts", () => {
  const T = DEFAULT_THRESHOLDS;
  it("umbrales por defecto: 16 °C, 28 °C, 70 % y batería 20 %", () => {
    expect(T).toEqual({ temperature_below: 16, temperature_above: 28, humidity_above: 70, battery_below: 20 });
  });
  it("sin problemas, sin avisos", () => {
    expect(roomAlerts({ temperature: 22, humidity: 50, battery: 100, offline: false, outdoor: false }, T)).toEqual([]);
  });
  it("frío, calor, humedad y batería", () => {
    const kinds = (r: Parameters<typeof roomAlerts>[0]) => roomAlerts(r, T).map((a) => a.kind);
    expect(kinds({ temperature: 15.9, humidity: 50, battery: 100, offline: false, outdoor: false })).toEqual(["cold"]);
    expect(kinds({ temperature: 28.5, humidity: 71, battery: 19, offline: false, outdoor: false })).toEqual(["battery", "hot", "humid"]);
  });
  it("una estancia exterior solo avisa por la batería o si no responde", () => {
    const r = roomAlerts({ temperature: 35, humidity: 90, battery: 10, offline: false, outdoor: true }, T);
    expect(r.map((a) => a.kind)).toEqual(["battery"]);
  });
  it("sin respuesta: solo «no responde»", () => {
    const r = roomAlerts({ temperature: null, humidity: null, battery: null, offline: true, outdoor: false }, T);
    expect(r).toEqual([{ kind: "offline", text: "No responde" }]);
  });
});

describe("parseHistory", () => {
  it("lee el formato comprimido de HA (s y lu en segundos) y descarta lo que no es número", () => {
    const raw = { "sensor.a": [
      { s: "22.4", lu: NOW / 1000 - 3600 }, { s: "unavailable", lu: NOW / 1000 - 1800 }, { s: "", lu: NOW / 1000 - 900 }, { s: "23", lu: NOW / 1000 },
    ] };
    expect(parseHistory(raw)).toEqual({ "sensor.a": [{ t: NOW - H, v: 22.4 }, { t: NOW, v: 23 }] });
    expect(parseHistory(undefined)).toEqual({});
  });
});

describe("sparkline", () => {
  it("puntos de la polilínea en un lienzo de 100×24, escalados al mínimo y máximo", () => {
    const pts = [{ t: NOW - 24 * H, v: 20 }, { t: NOW - 12 * H, v: 22 }, { t: NOW, v: 21 }];
    expect(sparkline(pts, NOW, 24)).toBe("0,22 50,2 100,12");
  });
  it("una línea plana va por el medio y alarga el último valor hasta ahora", () => {
    expect(sparkline([{ t: NOW - 6 * H, v: 21 }], NOW, 24)).toBe("75,12 100,12");
  });
  it("sin datos, nada", () => {
    expect(sparkline([], NOW, 24)).toBeNull();
  });
});

describe("trend", () => {
  const pts = (ago: number, v: number) => ({ t: NOW - ago, v });
  it("sube o baja si cambió 0,3 °C o más en la última hora", () => {
    expect(trend([pts(2 * H, 20), pts(H, 21), pts(0, 21.4)], 21.4, NOW)).toBe("up");
    expect(trend([pts(H, 21), pts(0, 20.6)], 20.6, NOW)).toBe("down");
    expect(trend([pts(H, 21), pts(0, 21.2)], 21.2, NOW)).toBe("flat");
  });
  it("sin historia o sin valor actual, sin flecha", () => {
    expect(trend([], 21, NOW)).toBeNull();
    expect(trend([pts(H, 21)], null, NOW)).toBeNull();
  });
});

describe("buildRoomView", () => {
  it("junta valores, color y avisos de una estancia", () => {
    const { hass } = makeHass();
    const v = buildRoomView(hass, SALON, {}, NOW);
    expect(v).toMatchObject({ name: "Salón", entity: SALON.temperature, temperature: 24.6, humidity: 50.2, battery: 100, level: "comfort", alerts: [] });
    expect(v.spark).toBeNull();
    expect(v.trend).toBeNull();
  });
  it("sensor caído: «no responde» y color desconocido", () => {
    const { hass } = makeHass({ [SALON.temperature]: st("unavailable") });
    const v = buildRoomView(hass, SALON, {}, NOW);
    expect(v.level).toBe("unknown");
    expect(v.alerts.map((a) => a.kind)).toEqual(["offline"]);
  });
  it("una entidad que ni existe también es «no responde»", () => {
    const { hass } = makeHass({ [SALON.temperature]: undefined });
    expect(buildRoomView(hass, SALON, {}, NOW).alerts.map((a) => a.kind)).toEqual(["offline"]);
  });
  it("con historia: curva y tendencia", () => {
    const { hass } = makeHass();
    const history = { [SALON.temperature]: [{ t: NOW - 2 * H, v: 23.5 }, { t: NOW - H, v: 24 }, { t: NOW, v: 24.6 }] };
    const v = buildRoomView(hass, SALON, history, NOW);
    expect(v.trend).toBe("up");
    expect(v.spark).not.toBeNull();
  });
  it("exterior con calor y humedad altas: sin avisos", () => {
    const { hass } = makeHass({ [PISCINA.temperature]: st("36"), [PISCINA.humidity!]: st("85") });
    expect(buildRoomView(hass, PISCINA, {}, NOW).alerts).toEqual([]);
  });
});
