import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, Boxes, Clock3, Factory, Gauge, PackageCheck, Pause, Play, RotateCcw,
  ShieldCheck, Workflow,
} from 'lucide-react';
import ConveyorCanvas from './ConveyorCanvas';
import { SimulationEngine, SimulationStats } from './simulationEngine';

const engine = new SimulationEngine();
const initialStats = engine.getStats();

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function App() {
  const engineRef = useRef(engine);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<SimulationStats>(initialStats);
  const lastFrame = useRef(0);
  const lastStatsUpdate = useRef(0);

  useEffect(() => {
    let frame = 0;
    const animate = (now: number) => {
      const delta = lastFrame.current ? (now - lastFrame.current) / 1000 : 0;
      lastFrame.current = now;
      engineRef.current.step(delta);
      if (now - lastStatsUpdate.current > 150) {
        setStats(engineRef.current.getStats());
        lastStatsUpdate.current = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleRunning = () => {
    const next = !running;
    engineRef.current.setRunning(next);
    setRunning(next);
  };

  const reset = () => {
    engineRef.current.reset(false);
    setRunning(false);
    setStats(engineRef.current.getStats());
    lastFrame.current = 0;
  };

  const updateSpeed = (value: number) => {
    setSpeed(value);
    engineRef.current.setSpeed(value);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Workflow size={17} strokeWidth={2.1} /></span>
          <span className="brand-name">flowline</span>
          <span className="brand-sub">INTRALOGISTIEK · SIMULATOR</span>
        </div>
        <div className="topbar-right">
          <span className="live-label"><i className="live-dot" /> {running ? 'SIMULATIE ACTIEF' : 'SIMULATIE GEREED'}</span>
          <span className="topbar-divider" />
          <span>MODEL 01.04</span>
        </div>
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">OPERATIONS / FLOW SIMULATION</div>
            <h1 className="page-title">Rollenbaan & orderverwerking</h1>
            <p className="page-description">Live overzicht van de interne goederenstroom en parallelle pickstations.</p>
          </div>
          <div className="session-tag"><ShieldCheck size={13} /> <span>SIMULATIEOMGEVING</span></div>
        </div>

        <section className="metrics-grid" aria-label="Simulatiestatistieken">
          <Metric label="Actieve bakken" value={stats.activeBins} unit="stuks" icon={<Boxes size={16} />} />
          <Metric label="Verwerkte orders" value={stats.processedOrders} unit="orders" icon={<PackageCheck size={16} />} />
          <Metric label="Afgevoerd" value={stats.outputBins} unit="bakken" icon={<Factory size={16} />} />
          <Metric label="Simulatietijd" value={formatClock(stats.elapsed)} unit="mm:ss" icon={<Clock3 size={16} />} />
        </section>

        <section className="simulation-panel" aria-label="Simulatiebediening en visualisatie">
          <div className="panel-toolbar">
            <div className="panel-title"><Activity size={15} /> Systeemoverzicht <span className="panel-meta">LIVE MODEL</span></div>
            <div className="toolbar-actions">
              <button className={`control-button primary ${running ? 'is-running' : ''}`} onClick={toggleRunning}>
                {running ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                {running ? 'Pauzeren' : 'Start simulatie'}
              </button>
              <button className="control-button icon-only" onClick={reset} aria-label="Simulatie resetten" title="Simulatie resetten">
                <RotateCcw size={14} />
              </button>
              <div className="speed-control">
                <Gauge size={13} color="#75827b" />
                <label htmlFor="simulation-speed">SNELHEID</label>
                <input
                  id="simulation-speed"
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={speed}
                  onChange={(event) => updateSpeed(Number(event.target.value))}
                  aria-label="Simulatiesnelheid"
                />
                <output htmlFor="simulation-speed">{speed.toFixed(1)}x</output>
              </div>
            </div>
          </div>
          <div className="canvas-frame">
            <ConveyorCanvas engine={engineRef.current} />
          </div>
          <div className="canvas-caption">
            <div className="legend" aria-label="Legenda">
              <span className="legend-item"><i className="legend-dot" /> In bewerking</span>
              <span className="legend-item"><i className="legend-dot active" /> Station 01</span>
              <span className="legend-item"><i className="legend-dot finished" /> Gereed voor afvoer</span>
              <span className="legend-item"><i className="legend-dot" style={{ background: '#72a28b' }} /> Station 02</span>
            </div>
            <span className="clock">SIM-TIJD&nbsp; {formatClock(stats.elapsed)}</span>
          </div>
        </section>

        <div className="bottom-row">
          <section className="info-strip" aria-label="Werkstationstatus">
            <div className="info-title"><Activity size={14} /> Werkstationbelasting</div>
            <div className="station-pills">
              <span className="station-pill">ST 01 <b>{String(stats.stationLoads[0]).padStart(2, '0')} / 10</b></span>
              <span className="station-pill">ST 02 <b>{String(stats.stationLoads[1]).padStart(2, '0')} / 10</b></span>
            </div>
          </section>
          <section className="info-strip" aria-label="Processtatus">
            <div className="info-title"><Workflow size={14} /> Processtatus</div>
            <div className="flow-note">Toevoer <b>→</b> Uitsluizer <b>→</b> Pickstation <b>→</b> Afvoer</div>
          </section>
        </div>
      </main>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: number | string;
  unit: string;
  icon: ReactNode;
}

function Metric({ label, value, unit, icon }: MetricProps) {
  return (
    <article className="metric">
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}<span className="metric-unit">{unit}</span></div>
      </div>
      <span className="metric-icon">{icon}</span>
    </article>
  );
}

