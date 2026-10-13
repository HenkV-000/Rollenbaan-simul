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

## Publiceren op GitHub Pages

De GitHub Actions-workflow bouwt en publiceert de website automatisch bij elke push naar `main`. Eenmalig instellen:

1. Push de repository naar GitHub.
2. Open **Settings → Pages** in de GitHub-repository.
3. Kies bij **Build and deployment → Source** voor **GitHub Actions**.
4. Open **Actions** en wacht tot **Deploy to GitHub Pages** is geslaagd.

De website staat daarna op `https://henkv-000.github.io/Rollenbaan-simul/`. Bezoekers hebben alleen een browser nodig. Elke volgende push naar `main` publiceert automatisch de nieuwe versie.

## Bediening

- **Start simulatie / Pauzeren** om de goederenstroom te starten of stil te zetten.
- **Snelheid** om de simulatie tussen 0,5x en 3x in te stellen.
- **Reset** om de simulatie terug te zetten naar de beginsituatie.

Meerdere lege bakken staan klaar in de invoerbuffer. De voorste bak schuift de rollenbaan op; de buffer wordt vanaf de invoerzijde aangevuld. Bakken bewegen glijdend tussen hoofdlus en parallelle put-to-light-baan: eerst omhoog bij de ingang en daarna horizontaal naar de eerste vrije positie. Per keer brandt één put-to-light-lamp en loopt de operator vanaf zijn vaste Modula naar de gekozen bak en terug. Als een bak wordt opgehaald, schuiven de overige bakken door. Een deel van de bakken uit werkstation 1 gaat na de eerste pick ook langs werkstation 2 voordat ze naar de afvoer gaan. Het dashboard toont de actuele bakken, orders, stationsbelasting en simulatietijd.

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
