# Flowline | Rollenbaansimulatie

Interactieve browser-simulatie van een intralogistiek systeem met een rollenbaan, twee Modula VLM-werkstations, put-to-light-posities, operatoren en een aparte afvoerbaan.

## Starten

Vereist Node.js 20.19+ of 22.12+.

```bash
npm install
npm run dev
```

Open de URL die Vite in de terminal toont, meestal `http://localhost:5173`.

```bash
npm run build
npm run preview
```

## Bediening

- **Start simulatie / Pauzeren** om de goederenstroom te starten of stil te zetten.
- **Snelheid** om de simulatie tussen 0,5x en 3x in te stellen.
- **Reset** om de simulatie terug te zetten naar de beginsituatie.

Meerdere lege bakken staan klaar in de invoerbuffer. De voorste bak schuift de rollenbaan op; de buffer wordt vanaf de invoerzijde aangevuld. Bakken stromen per werkstation de put-to-light-baan op, met maximaal één bak per positie. Als een bak wordt opgehaald, schuiven de overige bakken door. De operator loopt van een Modula-unit naar een actieve put-to-light-positie. Na het picken keert de bak via de transfer terug naar de hoofdlus en wordt hij bij de afvoer uitgesluisd. Het dashboard toont de actuele bakken, orders, stationsbelasting en simulatietijd.

## Bestandsstructuur

```text
src/
	App.tsx             Bediening, statistieken en applicatielay-out
	ConveyorCanvas.tsx  Canvasrenderer voor banen, bakken, operatoren en stations
	simulationEngine.ts Simulatiestatus, logistieke routes en operatorworkflow
	index.css           Tailwind-basis en applicatiestijlen
	main.tsx            React-startpunt
index.html
tailwind.config.js
vite.config.ts
```
