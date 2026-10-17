import { describe, it, expect } from "vitest";
import "../src/home-climate-card";
import { validateConfig } from "../src/home-climate-card";
import { CARD_CONFIG, makeHass, st, SALON, PISCINA } from "./fixtures";

type Card = HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<boolean> };

const NOW_S = Date.now() / 1000;

async function mount(overrides = {}, config: unknown = CARD_CONFIG, history: unknown = {}) {
  const fake = makeHass(overrides, history);
  const card = document.createElement("home-climate-card") as Card;
  card.setConfig(config);
  card.hass = fake.hass;
  const events: { type: string; detail: unknown }[] = [];
  card.addEventListener("hass-more-info", (e) => events.push({ type: e.type, detail: (e as CustomEvent).detail }));
  document.body.appendChild(card);
  await card.updateComplete;
  // La historia llega en otra vuelta del bucle de eventos.
  await new Promise((r) => setTimeout(r, 0));
  await card.updateComplete;
  const root = card.shadowRoot!;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement | null;
  const $$ = (sel: string) => Array.from(root.querySelectorAll(sel)) as HTMLElement[];
  return { card, $, $$, ws: fake.ws, events };
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, " ").trim();

describe("validateConfig", () => {
  it("pide plantas, y nombre y temperatura en cada estancia", () => {
    expect(() => validateConfig({} as never)).toThrow("floors");
    expect(() => validateConfig({ floors: [{ name: "P", rooms: [{ temperature: "sensor.t" }] }] } as never)).toThrow("name");
    expect(() => validateConfig({ floors: [{ name: "P", rooms: [{ name: "Salón" }] }] } as never)).toThrow("temperature");
    expect(validateConfig(CARD_CONFIG)).toBe(CARD_CONFIG);
  });
});

describe("render", () => {
  it("cabecera con el exterior, AEMET y las medias", async () => {
    const { $, $$ } = await mount();
    expect(text($(".out .big"))).toBe("22,4°");
    expect(text($(".out .sub"))).toContain("AEMET 22,2° · sensación 23,0° · 52 %");
    expect($$(".chip").map(text)).toEqual(["Casa 24,1°", "P. baja 24,5°"]);
  });

  it("plantas y estancias, con temperatura, humedad y color", async () => {
    const { $$ } = await mount();
    expect($$(".floor .fh").map(text)).toEqual(["Planta baja", "Sótano", "Exterior"]);
    const rooms = $$(".room");
    expect(rooms.map((r) => text(r.querySelector(".rn")))).toEqual(["Salón", "Cocina", "Sótano", "Piscina"]);
    expect(text(rooms[0].querySelector(".rt"))).toBe("24,6°");
    expect(text(rooms[0].querySelector(".rh"))).toBe("50 %");
    expect(rooms[0].classList.contains("comfort")).toBe(true);
    expect(rooms.some((r) => r.classList.contains("bad"))).toBe(false);
  });

  it("avisos: batería baja con icono y estancia fuera de rango con borde", async () => {
    const { $$ } = await mount({ [SALON.battery!]: st("12"), [SALON.temperature]: st("29.2") });
    const salon = $$(".room")[0];
    expect(salon.classList.contains("bad")).toBe(true);
    expect(salon.classList.contains("hot")).toBe(true);
    expect(salon.querySelector(".ico.battery")).not.toBeNull();
    expect(salon.getAttribute("title")).toBe("Batería 12 % · Calor: 29,2°");
  });

  it("sensor que no responde: guion y aviso", async () => {
    const { $$ } = await mount({ [SALON.temperature]: st("unavailable") });
    const salon = $$(".room")[0];
    expect(text(salon.querySelector(".rt"))).toBe("—");
    expect(salon.querySelector(".ico.offline")).not.toBeNull();
  });

  it("tocar una estancia abre el detalle de su temperatura", async () => {
    const { $$, events } = await mount();
    $$(".room")[3].click();
    expect(events).toEqual([{ type: "hass-more-info", detail: { entityId: PISCINA.temperature } }]);
  });

  it("pide la historia de todas las temperaturas una vez y pinta las curvas", async () => {
    const history = { [SALON.temperature]: [{ s: "23.5", lu: NOW_S - 7200 }, { s: "24.6", lu: NOW_S - 60 }] };
    const { $$, ws } = await mount({}, CARD_CONFIG, history);
    expect(ws).toHaveLength(1);
    expect(ws[0]).toMatchObject({
      type: "history/history_during_period", minimal_response: true, no_attributes: true,
      entity_ids: CARD_CONFIG.floors.flatMap((f) => f.rooms.map((r) => r.temperature)),
    });
    const rooms = $$(".room");
    expect(rooms[0].querySelector("svg polyline")).not.toBeNull();
    expect(rooms[0].querySelector(".tr ha-icon")?.getAttribute("icon")).toBe("mdi:arrow-up");
    expect(rooms[1].querySelector("svg polyline")).toBeNull();
  });
});

describe("only_alerts", () => {
  it("sin avisos no pinta nada ni pide historia", async () => {
    const { $, ws } = await mount({}, { ...CARD_CONFIG, only_alerts: true });
    expect($("ha-card")).toBeNull();
    expect(ws).toHaveLength(0);
  });

  it("solo las estancias con aviso, sin cabecera ni plantas vacías", async () => {
    const { $, $$ } = await mount({ [SALON.battery!]: st("5") }, { ...CARD_CONFIG, only_alerts: true });
    expect($(".out")).toBeNull();
    expect($$(".floor .fh").map(text)).toEqual(["Planta baja"]);
    expect($$(".room").map((r) => text(r.querySelector(".rn")))).toEqual(["Salón"]);
    expect(text($(".room .why"))).toBe("Batería 5 %");
  });
});
