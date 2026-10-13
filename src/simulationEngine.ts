export type BinMode = 'feed' | 'main' | 'entering' | 'station' | 'returning' | 'output';
export type StationId = 0 | 1;

export interface Bin {
  id: number;
  distance: number;
  feedPosition: number;
  mode: BinMode;
  targetStation: StationId;
  returnStation: StationId;
  processed: boolean;
  slot: number;
  slotTransitionFrom: number;
  slotProgress: number;
  entryPhase: 'vertical' | 'horizontal';
  entryProgress: number;
  serviceTime: number;
  returnProgress: number;
  outputProgress: number;
  previousDistance: number;
  finishedAt: number;
}

export interface Operator {
  phase: 'at-vlm' | 'to-bin' | 'to-vlm';
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
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
export const OUTPUT_LANE_START_X = 795;
export const OUTPUT_LANE_END_X = 1130;
export const OUTPUT_LANE_Y = 706;
export const OUTPUT_DROP_LENGTH = OUTPUT_LANE_Y - TRACK.bottomY;
export const OUTPUT_PATH_LENGTH = OUTPUT_DROP_LENGTH + OUTPUT_LANE_END_X - OUTPUT_LANE_START_X;
const OUTPUT_SPEED = 55;
const MAX_BINS = 22;
const SPAWN_INTERVAL = 0.8;
const FEED_START = 48;
const FEED_END = 208;
const FEED_SPACING = 40;
const MAIN_ENTRY_CLEARANCE = 42;
const TRANSFER_SPEED = 95;
const OPERATOR_SPEED = 105;
const VLM_FIRST_CENTER_OFFSET = 61.5;
const VLM_SPACING = 101;
const VLM_COUNT = 3;
const OPERATOR_HOME_Y = 254;

function getOperatorSpeed(station: Station) {
  return station.bins.length < 3 ? OPERATOR_SPEED * 0.8 : OPERATOR_SPEED;
}

function createOperator(station: Station, vlmIndex = station.id): Operator {
  const fromX = station.startX + VLM_FIRST_CENTER_OFFSET + vlmIndex * VLM_SPACING;
  return {
    phase: 'at-vlm',
    x: fromX,
    y: OPERATOR_HOME_Y,
    homeX: fromX,
    homeY: OPERATOR_HOME_Y,
    fromX,
    fromY: OPERATOR_HOME_Y,
    targetX: fromX,
    targetY: OPERATOR_HOME_Y,
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
          phase: 'at-vlm',
          x: startX + VLM_FIRST_CENTER_OFFSET + id * VLM_SPACING,
          y: OPERATOR_HOME_Y,
          homeX: startX + VLM_FIRST_CENTER_OFFSET + id * VLM_SPACING,
          homeY: OPERATOR_HOME_Y,
          fromX: startX + VLM_FIRST_CENTER_OFFSET + id * VLM_SPACING,
          fromY: OPERATOR_HOME_Y,
          targetX: startX + VLM_FIRST_CENTER_OFFSET + id * VLM_SPACING,
          targetY: OPERATOR_HOME_Y,
          elapsed: 0, duration: 0, targetBinId: null, vlmIndex: id,
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
    for (let index = 0; index < 5; index += 1) {
      this.bins.push(this.newBin(0, index % 2 as StationId, 'feed', FEED_START + index * FEED_SPACING));
    }
    this.stationTarget = 1;
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
    while (this.spawnClock >= this.nextSpawnAt && this.bins.length < MAX_BINS && this.canAddFeedBin()) {
      this.spawnClock -= this.nextSpawnAt;
      this.nextSpawnAt = SPAWN_INTERVAL * (0.82 + Math.random() * 0.36);
      this.bins.push(this.newBin(0, this.stationTarget, 'feed', FEED_START));
      this.stationTarget = (1 - this.stationTarget) as StationId;
    }

    this.stepFeedBins(delta);
    for (const bin of this.bins) {
      if (bin.mode === 'main') this.stepMainBin(bin, delta);
      else if (bin.mode === 'entering') this.stepEnteringBin(bin, delta);
      else if (bin.mode === 'station') {
        bin.serviceTime += delta;
        bin.slotProgress = Math.min(1, bin.slotProgress + delta / 0.25);
      }
      else if (bin.mode === 'returning') this.stepReturningBin(bin, delta);
      else if (bin.mode === 'output') this.stepOutputBin(bin, delta);
    }

    this.assignNextPick();
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
    return this.bins.find((bin) =>
      bin.id === binId && (bin.mode === 'station' || bin.mode === 'entering') && station.bins.includes(bin.id),
    );
  }

  private newBin(distance: number, targetStation: StationId, mode: BinMode = 'main', feedPosition = FEED_START): Bin {
    return {
      id: this.nextBinId++, distance, feedPosition, mode, targetStation, returnStation: targetStation, processed: false,
      slot: -1, slotTransitionFrom: -1, slotProgress: 1,
      entryPhase: 'vertical', entryProgress: 0,
      serviceTime: 0, returnProgress: 0, outputProgress: 0,
      previousDistance: distance, finishedAt: 0,
    };
  }

  private canAddFeedBin() {
    const tailPosition = this.bins
      .filter((bin) => bin.mode === 'feed')
      .reduce((position, bin) => Math.min(position, bin.feedPosition), Infinity);
    return tailPosition === Infinity || tailPosition - FEED_START >= FEED_SPACING;
  }

  private stepFeedBins(delta: number) {
    const feedBins = this.bins
      .filter((bin) => bin.mode === 'feed')
      .sort((first, second) => second.feedPosition - first.feedPosition);
    let previousPosition = Infinity;
    for (const bin of feedBins) {
      const limit = Math.min(FEED_END, previousPosition - FEED_SPACING);
      bin.feedPosition = Math.min(bin.feedPosition + TRANSFER_SPEED * delta, limit);
      previousPosition = bin.feedPosition;
      if (bin.feedPosition >= FEED_END && this.isMainEntryClear()) {
        bin.mode = 'main';
        bin.distance = 0;
        bin.previousDistance = 0;
        bin.feedPosition = 0;
      }
    }
  }

  private isMainEntryClear() {
    return !this.bins.some((bin) =>
      bin.mode === 'main'
      && (bin.distance < MAIN_ENTRY_CLEARANCE || bin.distance > LOOP_LENGTH - MAIN_ENTRY_CLEARANCE),
    );
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
        bin.mode = 'entering';
        bin.distance = station.entryDistance;
        bin.previousDistance = station.entryDistance;
        bin.slot = slot;
        bin.entryPhase = 'vertical';
        bin.entryProgress = 0;
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

  private stepEnteringBin(bin: Bin, delta: number) {
    if (bin.entryPhase === 'vertical') {
      bin.entryProgress = Math.min(1, bin.entryProgress + TRANSFER_SPEED * delta / (TRACK.topY - this.stations[bin.targetStation].laneY));
      if (bin.entryProgress >= 1) {
        bin.entryPhase = 'horizontal';
        bin.entryProgress = 0;
      }
      return;
    }

    const station = this.stations[bin.targetStation];
    const horizontalDistance = station.startX + 30 + bin.slot * 31 - (station.startX + 24);
    bin.entryProgress = Math.min(1, bin.entryProgress + TRANSFER_SPEED * delta / Math.max(6, horizontalDistance));
    if (bin.entryProgress >= 1) bin.mode = 'station';
  }

  private stepReturningBin(bin: Bin, delta: number) {
    bin.returnProgress = Math.min(1, bin.returnProgress + TRANSFER_SPEED * delta / 125);
    if (bin.returnProgress >= 1) {
      bin.distance = this.stations[bin.returnStation].exitDistance;
      bin.previousDistance = bin.distance;
      bin.mode = 'main';
    }
  }

  private stepOutputBin(bin: Bin, delta: number) {
    bin.outputProgress = Math.min(1, bin.outputProgress + OUTPUT_SPEED * delta / OUTPUT_PATH_LENGTH);
    if (bin.outputProgress >= 1) this.outputBins += 1;
  }

  private stepOperator(station: Station, delta: number) {
    const operator = station.operator;
    if (operator.phase === 'at-vlm') return;

    operator.elapsed += delta;
    const progress = Math.min(1, operator.elapsed / operator.duration);
    if (operator.phase === 'to-bin' || operator.phase === 'to-vlm') {
      operator.x = operator.fromX + (operator.targetX - operator.fromX) * progress;
      operator.y = operator.fromY + (operator.targetY - operator.fromY) * progress;
    }

    if (progress < 1) return;
    if (operator.phase === 'to-bin') {
      const bin = operator.targetBinId === null ? undefined : this.getStationBin(station, operator.targetBinId);
      if (bin) {
        bin.mode = 'returning';
        bin.returnStation = station.id;
        const continuesAtStationTwo = station.id === 0 && Math.random() < 0.35;
        bin.processed = !continuesAtStationTwo;
        if (continuesAtStationTwo) bin.targetStation = 1;
        bin.returnProgress = 0;
        station.bins = station.bins.filter((id) => id !== bin.id);
        this.compactStationBins(station);
        this.processedOrders += 1;
        station.completed += 1;
      }
      operator.phase = 'to-vlm';
      operator.elapsed = 0;
      operator.fromX = operator.x;
      operator.fromY = operator.y;
      operator.vlmIndex = (operator.vlmIndex + 1 + Math.floor(Math.random() * (VLM_COUNT - 1))) % VLM_COUNT;
      operator.homeX = station.startX + VLM_FIRST_CENTER_OFFSET + operator.vlmIndex * VLM_SPACING;
      operator.targetX = operator.homeX;
      operator.targetY = operator.homeY;
      operator.duration = Math.max(0.65, Math.hypot(
        operator.targetX - operator.fromX,
        operator.targetY - operator.fromY,
      ) / getOperatorSpeed(station));
    } else {
      operator.phase = 'at-vlm';
      operator.elapsed = 0;
      operator.targetBinId = null;
    }
  }

  private assignNextPick() {
    for (const station of this.stations) {
      const operator = station.operator;
      if (operator.phase !== 'at-vlm') continue;

      const candidates = station.bins
        .map((id) => this.getStationBin(station, id))
        .filter((bin): bin is Bin =>
          bin !== undefined && bin.mode === 'station' && bin.serviceTime > 0.75,
        );
      if (candidates.length === 0) continue;

      const bin = candidates[Math.floor(Math.random() * candidates.length)];
      operator.phase = 'to-bin';
      operator.targetBinId = bin.id;
      operator.fromX = operator.x;
      operator.fromY = operator.y;
      operator.targetX = station.startX + 30 + bin.slot * 31;
      operator.targetY = station.laneY - 58;
      operator.elapsed = 0;
      operator.duration = Math.max(0.65, Math.hypot(
        operator.targetX - operator.fromX,
        operator.targetY - operator.fromY,
      ) / getOperatorSpeed(station));
    }
  }

  private findFreeSlot(station: Station) {
    const occupied = new Set(
      station.bins
        .map((id) => this.bins.find((bin) => bin.id === id)?.slot)
        .filter((slot): slot is number => slot !== undefined),
    );
    for (let slot = 9; slot >= 0; slot -= 1) if (!occupied.has(slot)) return slot;
    return -1;
  }

  private compactStationBins(station: Station) {
    station.bins
      .map((id) => this.getStationBin(station, id))
      .filter((bin): bin is Bin => bin !== undefined)
      .sort((first, second) => second.slot - first.slot)
      .forEach((bin, index) => {
        const nextSlot = 9 - index;
        if (bin.mode === 'entering') {
          bin.slot = nextSlot;
        } else if (bin.slot !== nextSlot) {
          bin.slotTransitionFrom = bin.slot;
          bin.slotProgress = 0;
          bin.slot = nextSlot;
        }
      });
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
