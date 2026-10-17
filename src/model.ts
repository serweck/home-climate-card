import type { HomeAssistant } from "custom-card-helpers";
import type { Comfort, Level, Point, RoomAlert, RoomConfig, RoomView, Thresholds } from "./types";

export const DEFAULT_COMFORT: Comfort = { cold: 19, warm: 25, hot: 28 };
export const DEFAULT_THRESHOLDS: Thresholds = { temperature_below: 16, temperature_above: 28, humidity_above: 70, battery_below: 20 };
export const DEFAULT_HOURS = 24;

const HOUR = 3_600_000;
const DEAD = new Set(["unavailable", "unknown", ""]);
/** Cambio mínimo en la última hora para dibujar flecha de subida o bajada. */
const TREND_STEP = 0.3;
/** Lienzo de la curva (viewBox) y margen vertical para que el trazo no se corte. */
const SPARK_W = 100;
const SPARK_H = 24;
const SPARK_PAD = 2;
/** Alto mínimo de la curva en grados: si varía menos, se centra y el ruido del sensor no parece un salto. */
const SPARK_MIN_SPAN = 1;

export function num(hass: HomeAssistant, entity?: string): number | null {
  if (!entity) return null;
  const s = hass.states[entity];
  if (!s || DEAD.has(s.state)) return null;
  const n = Number(s.state);
  return Number.isFinite(n) ? n : null;
}

export function formatTemp(t: number | null): string {
  if (t === null) return "—";
  const text = Math.abs(t).toFixed(1).replace(".", ",");
  return `${t < 0 ? "−" : ""}${text}°`;
}

export function formatHumidity(h: number | null): string {
  return h === null ? "—" : `${Math.round(h)} %`;
}

export function levelFor(t: number | null, c: Comfort): Level {
  if (t === null) return "unknown";
  if (t < c.cold) return "cold";
  if (t <= c.warm) return "comfort";
  if (t <= c.hot) return "warm";
  return "hot";
}

interface AlertInput {
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  offline: boolean;
  outdoor: boolean;
}

export function roomAlerts(r: AlertInput, t: Thresholds): RoomAlert[] {
  if (r.offline) return [{ kind: "offline", text: "No responde" }];
  const out: RoomAlert[] = [];
  if (r.battery !== null && r.battery < t.battery_below) out.push({ kind: "battery", text: `Batería ${Math.round(r.battery)} %` });
  if (r.outdoor) return out;
  if (r.temperature !== null && r.temperature < t.temperature_below) out.push({ kind: "cold", text: `Frío: ${formatTemp(r.temperature)}` });
  if (r.temperature !== null && r.temperature > t.temperature_above) out.push({ kind: "hot", text: `Calor: ${formatTemp(r.temperature)}` });
  if (r.humidity !== null && r.humidity > t.humidity_above) out.push({ kind: "humid", text: `Humedad ${formatHumidity(r.humidity)}` });
  return out;
}

interface CompressedState { s?: string; lu?: number; lc?: number }

/** Respuesta de `history/history_during_period` (minimal_response, no_attributes) a puntos numéricos por entidad. */
export function parseHistory(raw: unknown): Record<string, Point[]> {
  const out: Record<string, Point[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [entity, list] of Object.entries(raw as Record<string, CompressedState[]>)) {
    if (!Array.isArray(list)) continue;
    out[entity] = list
      // Un estado vacío daría 0 con Number(""): se descarta como «unavailable».
      .map((p) => ({ t: Math.round((p.lu ?? p.lc ?? 0) * 1000), v: p.s ? Number(p.s) : NaN }))
      .filter((p) => p.t > 0 && Number.isFinite(p.v));
  }
  return out;
}

const round1 = (n: number) => String(Math.round(n * 10) / 10);

/** Puntos de una polilínea SVG (viewBox 0 0 100 24) con las últimas `hours` horas; el último valor se alarga hasta ahora. */
export function sparkline(points: Point[], now: number, hours: number): string | null {
  if (!points.length) return null;
  const start = now - hours * HOUR;
  const pts = [...points];
  if (pts[pts.length - 1].t < now) pts.push({ t: now, v: pts[pts.length - 1].v });
  const values = pts.map((p) => p.v);
  const span = Math.max(Math.max(...values) - Math.min(...values), SPARK_MIN_SPAN);
  const top = (Math.max(...values) + Math.min(...values)) / 2 + span / 2;
  return pts
    .map((p) => {
      const x = Math.max(0, ((p.t - start) / (hours * HOUR)) * SPARK_W);
      const y = SPARK_PAD + ((top - p.v) / span) * (SPARK_H - 2 * SPARK_PAD);
      return `${round1(x)},${round1(y)}`;
    })
    .join(" ");
}

/** Flecha según el cambio desde hace una hora (o desde el primer dato, si la historia es más corta). */
export function trend(points: Point[], current: number | null, now: number): RoomView["trend"] {
  if (!points.length || current === null) return null;
  const before = points.filter((p) => p.t <= now - HOUR);
  const ref = before.length ? before[before.length - 1].v : points[0].v;
  const diff = current - ref;
  if (diff >= TREND_STEP) return "up";
  if (diff <= -TREND_STEP) return "down";
  return "flat";
}

export interface ViewOptions {
  comfort?: Comfort;
  thresholds?: Thresholds;
  hours?: number;
}

export function buildRoomView(
  hass: HomeAssistant, room: RoomConfig, history: Record<string, Point[]>, now: number, opts: ViewOptions = {},
): RoomView {
  const temperature = num(hass, room.temperature);
  const humidity = num(hass, room.humidity);
  const battery = num(hass, room.battery);
  // La historia puede tener hasta 10 min: la curva termina en el valor actual, igual que el número y la flecha.
  const points = [...(history[room.temperature] ?? [])];
  if (points.length && temperature !== null && points[points.length - 1].t < now) points.push({ t: now, v: temperature });
  return {
    name: room.name,
    entity: room.temperature,
    temperature,
    humidity,
    battery,
    level: levelFor(temperature, opts.comfort ?? DEFAULT_COMFORT),
    alerts: roomAlerts({ temperature, humidity, battery, offline: temperature === null, outdoor: !!room.outdoor },
      opts.thresholds ?? DEFAULT_THRESHOLDS),
    trend: trend(points, temperature, now),
    spark: sparkline(points, now, opts.hours ?? DEFAULT_HOURS),
  };
}
