import type { HomeAssistant } from "custom-card-helpers";
import type { CardConfig } from "../src/types";

type Attrs = Record<string, unknown>;
export const st = (state: string, attributes: Attrs = {}) => ({ state, attributes, last_changed: "", last_updated: "" });

const ts = (n: string, room: string, kind: string) => `sensor.temperature_sensor_${n}_${room}_${kind}`;

/** Estados reales del 17-oct por la tarde. */
export function baseStates(): Record<string, ReturnType<typeof st>> {
  return {
    [ts("09", "salon", "temperature")]: st("24.6"),
    [ts("09", "salon", "humidity")]: st("50.2"),
    [ts("09", "salon", "battery")]: st("100"),
    [ts("06", "cocina", "temperature")]: st("24.9"),
    [ts("06", "cocina", "humidity")]: st("50.2"),
    [ts("06", "cocina", "battery")]: st("100"),
    [ts("04", "sotano", "temperature")]: st("23.3"),
    [ts("04", "sotano", "humidity")]: st("51.3"),
    [ts("04", "sotano", "battery")]: st("100"),
    [ts("02", "exterior_piscina", "temperature")]: st("22.4"),
    [ts("02", "exterior_piscina", "humidity")]: st("51.4"),
    [ts("02", "exterior_piscina", "battery")]: st("100"),
    "sensor.temperatura_exterior_termometros": st("22.4"),
    "sensor.aemet_temperature": st("22.2"),
    "sensor.aemet_temperature_feeling": st("23"),
    "sensor.aemet_humidity": st("52.0"),
    "sensor.temperatura_termostato": st("24.05"),
    "sensor.temperatura_planta_baja": st("24.5"),
  };
}

export const CARD_CONFIG: CardConfig = {
  title: "Temperaturas",
  outdoor: {
    temperature: "sensor.temperatura_exterior_termometros",
    humidity: "sensor.aemet_humidity",
    forecast: "sensor.aemet_temperature",
    feels_like: "sensor.aemet_temperature_feeling",
  },
  summary: [
    { name: "Casa", entity: "sensor.temperatura_termostato" },
    { name: "P. baja", entity: "sensor.temperatura_planta_baja" },
  ],
  floors: [
    {
      name: "Planta baja",
      rooms: [
        { name: "Salón", temperature: ts("09", "salon", "temperature"), humidity: ts("09", "salon", "humidity"), battery: ts("09", "salon", "battery") },
        { name: "Cocina", temperature: ts("06", "cocina", "temperature"), humidity: ts("06", "cocina", "humidity"), battery: ts("06", "cocina", "battery") },
      ],
    },
    {
      name: "Sótano",
      rooms: [{ name: "Sótano", temperature: ts("04", "sotano", "temperature"), humidity: ts("04", "sotano", "humidity"), battery: ts("04", "sotano", "battery") }],
    },
    {
      name: "Exterior",
      rooms: [{
        name: "Piscina", outdoor: true, temperature: ts("02", "exterior_piscina", "temperature"),
        humidity: ts("02", "exterior_piscina", "humidity"), battery: ts("02", "exterior_piscina", "battery"),
      }],
    },
  ],
};

export const SALON = CARD_CONFIG.floors[0].rooms[0];
export const PISCINA = CARD_CONFIG.floors[2].rooms[0];

export interface FakeHass {
  hass: HomeAssistant;
  ws: Record<string, unknown>[];
  moreInfo: string[];
}

export function makeHass(overrides: Record<string, ReturnType<typeof st> | undefined> = {}, history: unknown = {}): FakeHass {
  const states = { ...baseStates(), ...overrides };
  for (const k of Object.keys(states)) if (states[k] === undefined) delete states[k];
  const ws: Record<string, unknown>[] = [];
  const hass = {
    states,
    config: { time_zone: "Europe/Madrid" },
    callWS: async (msg: Record<string, unknown>) => { ws.push(msg); return history; },
    callService: async () => undefined,
  } as unknown as HomeAssistant;
  return { hass, ws, moreInfo: [] };
}
