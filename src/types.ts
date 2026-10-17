export interface RoomConfig {
  name: string;
  temperature: string;
  humidity?: string;
  battery?: string;
  /** Exterior (o garaje): nunca avisa por temperatura ni humedad. */
  outdoor?: boolean;
}

export interface FloorConfig {
  name: string;
  icon?: string;
  rooms: RoomConfig[];
}

export interface ChipConfig {
  name: string;
  entity: string;
}

export interface OutdoorConfig {
  temperature?: string;
  humidity?: string;
  forecast?: string;
  feels_like?: string;
}

export interface Thresholds {
  temperature_below: number;
  temperature_above: number;
  humidity_above: number;
  battery_below: number;
}

/** Límites del color: por debajo de `cold` es frío, hasta `warm` confort, hasta `hot` calor y por encima mucho calor. */
export interface Comfort {
  cold: number;
  warm: number;
  hot: number;
}

export interface CardConfig {
  type?: string;
  title?: string;
  outdoor?: OutdoorConfig;
  summary?: ChipConfig[];
  floors: FloorConfig[];
  alerts?: Partial<Thresholds>;
  comfort?: Partial<Comfort>;
  hours?: number;
  /** Solo las estancias con algún aviso (para la portada). */
  only_alerts?: boolean;
}

export type Level = "cold" | "comfort" | "warm" | "hot" | "unknown";

export interface RoomAlert {
  kind: "offline" | "battery" | "cold" | "hot" | "humid";
  text: string;
}

export interface Point {
  t: number;
  v: number;
}

export interface RoomView {
  name: string;
  entity: string;
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  level: Level;
  alerts: RoomAlert[];
  trend: "up" | "down" | "flat" | null;
  spark: string | null;
}
