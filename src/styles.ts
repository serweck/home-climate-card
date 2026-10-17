import { css } from "lit";

export const styles = css`
  :host {
    --hc-chip: var(--secondary-background-color, #262626);
    --hc-line: var(--divider-color, #2c2c2c);
    --hc-mut: var(--secondary-text-color, #9b9b9b);
    --hc-cold: 59, 130, 246;
    --hc-comfort: 34, 197, 94;
    --hc-warm: 245, 158, 11;
    --hc-hot: 239, 68, 68;
    --hc-unknown: 155, 155, 155;
  }
  ha-card { overflow: hidden; padding-bottom: 12px; }
  ha-icon { --mdc-icon-size: 18px; }
  .top { padding: 12px 14px; border-bottom: 1px solid var(--hc-line); display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
  .top .t { display: flex; gap: 8px; align-items: center; font-weight: 600; font-size: 15px; flex: 1 0 100%; }
  .out { display: flex; gap: 10px; align-items: center; cursor: pointer; flex: 1 1 auto; }
  .out > ha-icon { --mdc-icon-size: 30px; color: var(--hc-mut); }
  .out .big { font-size: 26px; font-weight: 600; line-height: 1.1; }
  .out .sub { font-size: 12px; color: var(--hc-mut); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 6px 10px; border-radius: 10px; background: var(--hc-chip); font-size: 12.5px; color: var(--hc-mut); cursor: pointer; }
  .chip b { color: var(--primary-text-color); font-weight: 600; margin-left: 2px; }
  .floor { padding: 0 14px; }
  .fh { display: flex; gap: 6px; align-items: center; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
        color: var(--hc-mut); margin: 14px 0 8px; }
  .fh ha-icon { --mdc-icon-size: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
  .room { --c: var(--hc-unknown); position: relative; border-radius: 14px; padding: 9px 10px 8px; cursor: pointer; overflow: hidden;
          background: rgba(var(--c), .12); border: 1px solid rgba(var(--c), .25); min-height: 74px; }
  .room.cold { --c: var(--hc-cold); }
  .room.comfort { --c: var(--hc-comfort); }
  .room.warm { --c: var(--hc-warm); }
  .room.hot { --c: var(--hc-hot); }
  .room.bad { border: 2px solid rgb(var(--hc-hot)); padding: 8px 9px 7px; }
  .rtop { display: flex; align-items: center; gap: 4px; }
  .rn { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ico { --mdc-icon-size: 16px; flex: none; }
  .ico.battery { color: rgb(var(--hc-warm)); }
  .ico.offline { color: rgb(var(--hc-hot)); }
  .rmid { display: flex; align-items: baseline; gap: 4px; margin-top: 2px; }
  .rt { font-size: 22px; font-weight: 600; color: rgb(var(--c)); line-height: 1.15; }
  .tr ha-icon { --mdc-icon-size: 14px; color: var(--hc-mut); }
  .rh { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--hc-mut); }
  .rh ha-icon { --mdc-icon-size: 14px; }
  .spark { display: block; width: 100%; height: 22px; margin-top: 4px; }
  .spark polyline { fill: none; stroke: rgb(var(--c)); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round;
                    vector-effect: non-scaling-stroke; opacity: .85; }
  .why { margin-top: 4px; font-size: 11.5px; color: rgb(var(--hc-hot)); }
`;
