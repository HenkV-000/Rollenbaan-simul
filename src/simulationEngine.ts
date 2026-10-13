export type BinMode = 'main' | 'station' | 'returning' | 'output';
export type StationId = 0 | 1;

export interface Bin {
  id: number;
  distance: number;
  mode: BinMode;
  targetStation: StationId;
  processed: boolean;
  slot: number;
  serviceTime: number;
  returnProgress: number;
  outputProgress: number;
  previousDistance: number;
  finishedAt: number;
}

export interface Operator {
  phase: 'at-vlm' | 'to-bin' | 'picking' | 'to-vlm';
  x: number;
  fromX: number;
  targetX: number;
  elapsed: number;
  duration: number;
  targetBinId: number | null;
  vlmIndex: number;
}

export interface Station {
  id: StationId;
  startX: number;
  endX: number;
  laneY: number;
  entryDistance: number;
  exitDistance: number;
  bins: number[];
  operator: Operator;
  completed: number;
}

export interface SimulationStats {
  activeBins: number;
  processedOrders: number;
  outputBins: number;
  stationLoads: [number, number];
  elapsed: number;
}

const TRACK = { startX: 210, endX: 1150, topY: 470, bottomY: 660, radius: 95 };
const TOP_LENGTH = TRACK.endX - TRACK.startX;
const ARC_LENGTH = Math.PI * TRACK.radius;
const BOTTOM_START = TOP_LENGTH + ARC_LENGTH;
export const LOOP_LENGTH = TOP_LENGTH * 2 + ARC_LENGTH * 2;
const OUTPUT_DISTANCE = BOTTOM_START + TRACK.endX - 795;
const MAX_BINS = 22;
const SPAWN_INTERVAL = 2.15;
const TRANSFER_SPEED = 95;
const OPERATOR_SPEED = 150;
const PICK_DURATION = 0.6;

function createOperator(station: Station, vlmIndex = station.id): Operator {
  const fromX = station.startX + 75 + vlmIndex * 86;
  return {
    phase: 'at-vlm',
    x: fromX,
    fromX,
    targetX: fromX,
    elapsed: 0,
    duration: 0,
    targetBinId: null,
    vlmIndex,
  };
}

export class SimulationEngine {
  bins: Bin[] = [];
  stations: [Station, Station];
  running = false;
  elapsed = 0;
  processedOrders = 0;
  outputBins = 0;
  speed = 1;
  private nextBinId = 1;
  private spawnClock = 0;
  private stationTarget: StationId = 0;
  private nextSpawnAt = 0.25;

  constructor() {
    this.stations = [0, 1].map((id) => {
      const startX = id === 0 ? 275 : 785;
      const endX = startX + 350;
      const station: Station = {
        id: id as StationId,
        startX,
        endX,
        laneY: id === 0 ? 354 : 354,
        entryDistance: startX + 24 - TRACK.startX,
        exitDistance: endX - 8 - TRACK.startX,
        bins: [],
        operator: {
          phase: 'at-vlm', x: startX + 75 + id * 86, fromX: startX + 75 + id * 86,
          targetX: startX + 75 + id * 86, elapsed: 0, duration: 0, targetBinId: null, vlmIndex: id,
        },
        completed: 0,
      };
      return station;
    }) as [Station, Station];
    this.reset(false);
  }

  reset(run = false) {
    this.bins = [];
    this.elapsed = 0;
    this.processedOrders = 0;
    this.outputBins = 0;
    this.spawnClock = 0;
    this.nextBinId = 1;
    this.stationTarget = 0;
    this.nextSpawnAt = 0.25;
    for (const station of this.stations) {
      station.bins = [];
      station.completed = 0;
      station.operator = createOperator(station, station.id);
    }
    for (let index = 0; index < 8; index += 1) {
      const distance = (index / 8) * LOOP_LENGTH;
      this.bins.push(this.newBin(distance, index % 2 as StationId));
    }
    this.running = run;
  }

  setRunning(running: boolean) {
    this.running = running;
  }

  setSpeed(speed: number) {
    this.speed = Math.max(0.5, Math.min(3, speed));
  }

  step(rawDelta: number) {
    if (!this.running) return;
    const delta = Math.min(rawDelta, 0.05) * this.speed;
    if (delta <= 0) return;
    this.elapsed += delta;
    this.spawnClock += delta;
    while (this.spawnClock >= this.nextSpawnAt && this.bins.length < MAX_BINS) {
      this.spawnClock -= this.nextSpawnAt;
      this.nextSpawnAt = SPAWN_INTERVAL * (0.82 + Math.random() * 0.36);
      this.bins.push(this.newBin(0, this.stationTarget));
      this.stationTarget = (1 - this.stationTarget) as StationId;
    }

    for (const bin of this.bins) {
      if (bin.mode === 'main') this.stepMainBin(bin, delta);
      else if (bin.mode === 'station') bin.serviceTime += delta;
      else if (bin.mode === 'returning') this.stepReturningBin(bin, delta);
      else if (bin.mode === 'output') this.stepOutputBin(bin, delta);
    }

    for (const station of this.stations) this.stepOperator(station, delta);
    this.bins = this.bins.filter((bin) => bin.mode !== 'output' || bin.outputProgress < 1);
  }

  getStats(): SimulationStats {
    return {
      activeBins: this.bins.length,
      processedOrders: this.processedOrders,
      outputBins: this.outputBins,
      stationLoads: [this.stations[0].bins.length, this.stations[1].bins.length],
      elapsed: this.elapsed,
    };
  }

  getStationBin(station: Station, binId: number) {
    return this.bins.find((bin) => bin.id === binId && bin.mode === 'station' && station.bins.includes(bin.id));
  }

  private newBin(distance: number, targetStation: StationId): Bin {
    return {
      id: this.nextBinId++, distance, mode: 'main', targetStation, processed: false,
      slot: -1, serviceTime: 0, returnProgress: 0, outputProgress: 0,
      previousDistance: distance, finishedAt: 0,
    };
  }

  private stepMainBin(bin: Bin, delta: number) {
    const previous = bin.distance;
    const next = (previous + 115 * delta) % LOOP_LENGTH;
    bin.previousDistance = previous;
    bin.distance = next;
    const station = this.stations[bin.targetStation];
    const passedEntry = next >= previous
      ? previous <= station.entryDistance && next > station.entryDistance
      : station.entryDistance > previous || station.entryDistance < next;

    if (!bin.processed && passedEntry && station.bins.length < 10) {
      const slot = this.findFreeSlot(station);
      if (slot !== -1) {
        bin.mode = 'station';
        bin.slot = slot;
        bin.serviceTime = 0;
        station.bins.push(bin.id);
      }
      return;
    }

    const passedOutput = next >= previous
      ? previous <= OUTPUT_DISTANCE && next > OUTPUT_DISTANCE
      : OUTPUT_DISTANCE > previous || OUTPUT_DISTANCE < next;
    if (bin.processed && passedOutput) {
      bin.mode = 'output';
      bin.outputProgress = 0;
      bin.finishedAt = 0;
    }
  }

  private stepReturningBin(bin: Bin, delta: number) {
    bin.returnProgress = Math.min(1, bin.returnProgress + TRANSFER_SPEED * delta / 125);
    if (bin.returnProgress >= 1) {
      bin.distance = this.stations[bin.targetStation].exitDistance;
      bin.previousDistance = bin.distance;
      bin.mode = 'main';
    }
  }

  private stepOutputBin(bin: Bin, delta: number) {
    bin.outputProgress = Math.min(1, bin.outputProgress + TRANSFER_SPEED * delta / 150);
    if (bin.outputProgress >= 1) this.outputBins += 1;
  }

  private stepOperator(station: Station, delta: number) {
    const operator = station.operator;
    if (operator.phase === 'at-vlm') {
      const bin = station.bins
        .map((id) => this.getStationBin(station, id))
        .find((candidate) => candidate && candidate.serviceTime > 0.25);
      if (!bin) return;
      operator.phase = 'to-bin';
      operator.targetBinId = bin.id;
      operator.fromX = operator.x;
      operator.targetX = station.startX + 30 + bin.slot * 31;
      operator.elapsed = 0;
      operator.duration = Math.max(0.65, Math.abs(operator.targetX - operator.fromX) / OPERATOR_SPEED);
      return;
    }

    operator.elapsed += delta;
    const progress = Math.min(1, operator.elapsed / operator.duration);
    operator.x = operator.fromX + (operator.targetX - operator.fromX) * progress;

    if (progress < 1) return;
    if (operator.phase === 'to-bin') {
      operator.phase = 'picking';
      operator.elapsed = 0;
      operator.duration = PICK_DURATION;
      const bin = operator.targetBinId === null ? undefined : this.getStationBin(station, operator.targetBinId);
      if (bin) {
        bin.mode = 'returning';
        bin.processed = true;
        bin.returnProgress = 0;
        station.bins = station.bins.filter((id) => id !== bin.id);
        this.processedOrders += 1;
        station.completed += 1;
      }
    } else if (operator.phase === 'picking') {
      operator.phase = 'to-vlm';
      operator.elapsed = 0;
      operator.vlmIndex = (operator.vlmIndex + 1) % 3;
      operator.fromX = operator.x;
      operator.targetX = station.startX + 75 + operator.vlmIndex * 86;
      operator.duration = Math.max(0.55, Math.abs(operator.targetX - operator.fromX) / OPERATOR_SPEED);
    } else {
      operator.phase = 'at-vlm';
      operator.elapsed = 0;
      operator.targetBinId = null;
    }
  }

  private findFreeSlot(station: Station) {
    const occupied = new Set(
      station.bins
        .map((id) => this.bins.find((bin) => bin.id === id)?.slot)
        .filter((slot): slot is number => slot !== undefined),
    );
    for (let slot = 0; slot < 10; slot += 1) if (!occupied.has(slot)) return slot;
    return -1;
  }
}

export function getMainPosition(distance: number) {
  const d = ((distance % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH;
  if (d < TOP_LENGTH) return { x: TRACK.startX + d, y: TRACK.topY, section: 'top' as const };
  if (d < TOP_LENGTH + ARC_LENGTH) {
    const angle = -Math.PI / 2 + ((d - TOP_LENGTH) / ARC_LENGTH) * Math.PI;
    return { x: TRACK.endX + Math.cos(angle) * TRACK.radius, y: (TRACK.topY + TRACK.bottomY) / 2 + Math.sin(angle) * TRACK.radius, section: 'right' as const };
  }
  if (d < BOTTOM_START + TOP_LENGTH) return { x: TRACK.endX - (d - BOTTOM_START), y: TRACK.bottomY, section: 'bottom' as const };
  const angle = Math.PI / 2 + ((d - BOTTOM_START - TOP_LENGTH) / ARC_LENGTH) * Math.PI;
  return { x: TRACK.startX + Math.cos(angle) * TRACK.radius, y: (TRACK.topY + TRACK.bottomY) / 2 + Math.sin(angle) * TRACK.radius, section: 'left' as const };
}

export function getTrackLayout() {
  return { ...TRACK, topLength: TOP_LENGTH, bottomStart: BOTTOM_START, outputDistance: OUTPUT_DISTANCE, loopLength: LOOP_LENGTH };
}
