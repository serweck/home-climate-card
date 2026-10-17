# Home Climate Card

Tarjeta Lovelace para Home Assistant con la temperatura y la humedad de cada estancia, agrupadas por plantas:

- **Cabecera** con el exterior (termómetro, previsión de AEMET, sensación térmica y humedad) y chips con las medias que quieras (casa, plantas…).
- **Una ficha por estancia**: temperatura grande, humedad, flecha de tendencia (última hora) y la curva de las últimas 24 h.
- **Color según el calor**: azul por debajo de 19 °C, verde hasta 25, ámbar hasta 28 y rojo por encima (configurable).
- **Avisos**: icono si la pila del sensor baja del 20 % o deja de responder; borde rojo si una estancia interior baja de 16 °C, pasa de 28 °C o del 70 % de humedad. Las estancias marcadas como `outdoor` solo avisan por la pila.
- **Tocar una ficha** abre el detalle de HA con su gráfica.
- **`only_alerts: true`**: solo las estancias con aviso (para una portada); sin avisos, la tarjeta no pinta nada.

## Instalación (HACS)

1. HACS → menú ⋮ → *Repositorios personalizados* → `https://github.com/serweck/home-climate-card`, tipo *Dashboard*.
2. Instala **Home Climate Card** y recarga el navegador.

## Configuración

```yaml
type: custom:home-climate-card
title: Temperaturas                                  # opcional
outdoor:                                             # opcional
  temperature: sensor.temperatura_exterior_termometros
  humidity: sensor.aemet_humidity
  forecast: sensor.aemet_temperature
  feels_like: sensor.aemet_temperature_feeling
summary:                                             # opcional
  - { name: Casa, entity: sensor.temperatura_termostato }
comfort: { cold: 19, warm: 25, hot: 28 }             # opcional (colores)
alerts:                                              # opcional (avisos)
  temperature_below: 16
  temperature_above: 28
  humidity_above: 70
  battery_below: 20
hours: 24                                            # opcional (curvas)
only_alerts: false                                   # opcional
floors:
  - name: Planta baja                                # obligatorio
    icon: mdi:home-floor-0
    rooms:
      - name: Salón                                  # obligatorio
        temperature: sensor.salon_temperature        # obligatorio
        humidity: sensor.salon_humidity
        battery: sensor.salon_battery
      - name: Piscina
        temperature: sensor.piscina_temperature
        outdoor: true                                # sin avisos de temperatura ni humedad
```

La historia de las curvas se pide a HA en una sola llamada (`history/history_during_period`) y se refresca cada 10 minutos.

## Desarrollo

`npm install`, `npm test`, `npm run build` y `npm run preview` (abre `preview.html` con datos de ejemplo).
