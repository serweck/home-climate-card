import { LitElement, html, nothing, svg, type TemplateResult } from "lit";
import type { HomeAssistant } from "custom-card-helpers";
import type { CardConfig, FloorConfig, Point, RoomView } from "./types";
import {
  DEFAULT_COMFORT, DEFAULT_HOURS, DEFAULT_THRESHOLDS, buildRoomView, formatHumidity, formatTemp, num, parseHistory,
} from "./model";
import { styles } from "./styles";

export const CARD_TAG = "home-climate-card";
export const CARD_VERSION = "0.1.0";

/** Cada cuánto se vuelve a pedir la historia de las curvas. */
const HISTORY_REFRESH = 10 * 60_000;

export function validateConfig(config: Partial<CardConfig> | undefined): CardConfig {
  const floors = config?.floors;
  if (!Array.isArray(floors) || floors.length === 0) throw new Error("floors: hace falta al menos una planta");
  floors.forEach((f, i) => {
    if (!f?.name) throw new Error(`floors[${i}].name es obligatorio`);
    if (!Array.isArray(f.rooms) || f.rooms.length === 0) throw new Error(`floors[${i}].rooms: hace falta al menos una estancia`);
    f.rooms.forEach((r, j) => {
      if (!r?.name) throw new Error(`floors[${i}].rooms[${j}].name es obligatorio`);
      if (!r.temperature) throw new Error(`floors[${i}].rooms[${j}].temperature es obligatorio`);
    });
  });
  return config as CardConfig;
}

const TREND_ICON = { up: "mdi:arrow-up", down: "mdi:arrow-down", flat: "mdi:arrow-right" } as const;
const ALERT_ICON = { offline: "mdi:access-point-network-off", battery: "mdi:battery-alert-variant-outline" } as const;

export class HomeClimateCard extends LitElement {
  static styles = styles;
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _history: { state: true },
  };

  // `declare` para que ningún compilador cree campos propios que tapen los accesores reactivos de lit.
  declare hass?: HomeAssistant;
  declare private _config?: CardConfig;
  declare private _history: Record<string, Point[]>;
  private _fetchedAt = 0;
  private _fetching = false;

  constructor() {
    super();
    this._history = {};
  }

  setConfig(config: CardConfig): void {
    this._config = validateConfig(config);
    this._fetchedAt = 0;
  }

  getCardSize(): number {
    if (!this._config) return 1;
    return 2 + this._config.floors.reduce((n, f) => n + Math.ceil(f.rooms.length / 3) * 2, 0);
  }

  protected updated(): void {
    if (this.hass && this._config && !this._config.only_alerts && !this._fetching && Date.now() - this._fetchedAt > HISTORY_REFRESH) {
      void this._fetchHistory();
    }
  }

  private async _fetchHistory(): Promise<void> {
    const cfg = this._config!;
    this._fetching = true;
    this._fetchedAt = Date.now();
    try {
      const hours = cfg.hours ?? DEFAULT_HOURS;
      const raw = await this.hass!.callWS({
        type: "history/history_during_period",
        start_time: new Date(Date.now() - hours * 3_600_000).toISOString(),
        entity_ids: cfg.floors.flatMap((f) => f.rooms.map((r) => r.temperature)),
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      this._history = parseHistory(raw);
    } catch {
      // Sin historia la tarjeta sigue siendo útil: se pinta sin curvas y se reintenta en el siguiente refresco.
    } finally {
      this._fetching = false;
    }
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _views(floor: FloorConfig): RoomView[] {
    const cfg = this._config!;
    const opts = {
      comfort: { ...DEFAULT_COMFORT, ...cfg.comfort },
      thresholds: { ...DEFAULT_THRESHOLDS, ...cfg.alerts },
      hours: cfg.hours ?? DEFAULT_HOURS,
    };
    return floor.rooms.map((r) => buildRoomView(this.hass!, r, this._history, Date.now(), opts));
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const cfg = this._config;
    const floors = cfg.floors
      .map((f) => ({ floor: f, rooms: this._views(f) }))
      .map((x) => (cfg.only_alerts ? { ...x, rooms: x.rooms.filter((r) => r.alerts.length) } : x))
      .filter((x) => x.rooms.length);
    if (cfg.only_alerts && !floors.length) return nothing;
    return html`
      <ha-card>
        ${cfg.only_alerts ? nothing : this._renderHeader()}
        ${floors.map(({ floor, rooms }) => html`<div class="floor">
          <div class="fh">${floor.icon ? html`<ha-icon icon=${floor.icon}></ha-icon>` : nothing}${floor.name}</div>
          <div class="grid">${rooms.map((r) => this._renderRoom(r))}</div>
        </div>`)}
      </ha-card>
    `;
  }

  private _renderHeader(): TemplateResult {
    const cfg = this._config!;
    const hass = this.hass!;
    const out = cfg.outdoor;
    const sub: string[] = [];
    const forecast = num(hass, out?.forecast);
    const feels = num(hass, out?.feels_like);
    const hum = num(hass, out?.humidity);
    if (forecast !== null) sub.push(`AEMET ${formatTemp(forecast)}`);
    if (feels !== null) sub.push(`sensación ${formatTemp(feels)}`);
    if (hum !== null) sub.push(formatHumidity(hum));
    return html`<div class="top">
      <div class="t"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${cfg.title ?? "Temperaturas"}</div>
      ${out
        ? html`<div class="out" @click=${() => out.temperature && this._moreInfo(out.temperature)}>
            <ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>
            <div><div class="big">${formatTemp(num(hass, out.temperature))}</div><div class="sub">${sub.join(" · ")}</div></div>
          </div>`
        : nothing}
      ${cfg.summary?.length
        ? html`<div class="chips">${cfg.summary.map((c) => html`<span class="chip" @click=${() => this._moreInfo(c.entity)}>${c.name}
            <b>${formatTemp(num(hass, c.entity))}</b></span>`)}</div>`
        : nothing}
    </div>`;
  }

  private _renderRoom(r: RoomView): TemplateResult {
    const bad = r.alerts.some((a) => a.kind !== "battery");
    const icons = r.alerts.filter((a) => a.kind === "offline" || a.kind === "battery");
    return html`<div class="room ${r.level} ${bad ? "bad" : ""}" title=${r.alerts.map((a) => a.text).join(" · ")}
        @click=${() => this._moreInfo(r.entity)}>
      <div class="rtop">
        <span class="rn">${r.name}</span>
        ${icons.map((a) => html`<ha-icon class="ico ${a.kind}" icon=${ALERT_ICON[a.kind as keyof typeof ALERT_ICON]}></ha-icon>`)}
      </div>
      <div class="rmid">
        <span class="rt">${formatTemp(r.temperature)}</span>
        ${r.trend ? html`<span class="tr"><ha-icon icon=${TREND_ICON[r.trend]}></ha-icon></span>` : nothing}
      </div>
      ${r.humidity !== null ? html`<div class="rh"><ha-icon icon="mdi:water-percent"></ha-icon>${formatHumidity(r.humidity)}</div>` : nothing}
      ${r.spark
        ? html`<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none">${svg`<polyline points=${r.spark}></polyline>`}</svg>`
        : nothing}
      ${this._config!.only_alerts ? html`<div class="why">${r.alerts.map((a) => a.text).join(" · ")}</div>` : nothing}
    </div>`;
  }
}

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, HomeClimateCard);

const w = window as unknown as { customCards?: unknown[] };
w.customCards = w.customCards || [];
w.customCards.push({
  type: CARD_TAG,
  name: "Home Climate Card",
  description: "Temperaturas y humedades de cada estancia, por plantas",
});

/* eslint-disable no-console */
console.info(`%c HOME-CLIMATE-CARD %c v${CARD_VERSION} `, "color:#fff;background:#22c55e;font-weight:700", "color:#22c55e");
