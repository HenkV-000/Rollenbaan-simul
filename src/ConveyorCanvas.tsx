import { useEffect, useRef } from 'react';
import {
  Bin, getMainPosition, getTrackLayout, OUTPUT_DROP_LENGTH, OUTPUT_LANE_END_X,
  OUTPUT_LANE_START_X, OUTPUT_LANE_Y, SimulationEngine, Station,
} from './simulationEngine';

const COLORS = {
  ink: '#19312d', muted: '#77827c', track: '#31423e', trackEdge: '#60706a',
  background: '#f5f6f0', panel: '#fbfcf8', orange: '#e66b3d', mint: '#c9e1d4',
  teal: '#247a71', amber: '#d79a3c', roller: '#77837d', pale: '#e8ece4',
};

interface ConveyorCanvasProps {
  engine: SimulationEngine;
}

export default function ConveyorCanvas({ engine }: ConveyorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let animationFrame = 0;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(bounds.width * pixelRatio);
      const height = Math.round(bounds.height * pixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(width / 1360, 0, 0, height / 740, 0, 0);
      renderScene(context, engine);
      animationFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [engine]);

  return <canvas ref={canvasRef} aria-label="Geanimeerde visualisatie van rollenbaan, twee Modula-werkstations en afvoerbaan" role="img" />;
}

function renderScene(ctx: CanvasRenderingContext2D, engine: SimulationEngine) {
  const track = getTrackLayout();
  ctx.clearRect(0, 0, 1360, 740);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, 1360, 740);
  drawGrid(ctx);
  drawStation(ctx, engine.stations[0], engine);
  drawStation(ctx, engine.stations[1], engine);
  drawMainLoop(ctx, engine);
  drawFeed(ctx);
  drawOutput(ctx);
  drawTransferPaths(ctx, engine.stations);

  for (const bin of engine.bins) {
    if (bin.mode === 'feed') drawBin(ctx, bin.feedPosition, 448, bin);
    if (bin.mode === 'main') drawBin(ctx, getMainPosition(bin.distance).x, getMainPosition(bin.distance).y, bin);
    if (bin.mode === 'entering') {
      const station = engine.stations[bin.targetStation];
      const entryX = station.startX + 24;
      const targetX = station.startX + 30 + bin.slot * 31;
      const progress = bin.entryProgress;
      const x = bin.entryPhase === 'vertical' ? entryX : entryX + (targetX - entryX) * progress;
      const y = bin.entryPhase === 'vertical'
        ? getTrackLayout().topY + (station.laneY - getTrackLayout().topY) * progress
        : station.laneY;
      drawBin(ctx, x, y, bin);
    }
    if (bin.mode === 'station') {
      const station = engine.stations[bin.targetStation];
      const slot = bin.slotTransitionFrom + (bin.slot - bin.slotTransitionFrom) * bin.slotProgress;
      const x = station.startX + 30 + slot * 31;
      drawBin(ctx, x, station.laneY, bin);
    }
    if (bin.mode === 'returning') {
      const station = engine.stations[bin.returnStation];
      const fromX = station.startX + 30 + bin.slot * 31;
      const x = fromX + (station.endX - fromX) * bin.returnProgress;
      const y = station.laneY + (track.topY - station.laneY) * bin.returnProgress;
      drawBin(ctx, x, y, bin);
    }
    if (bin.mode === 'output') {
      const outputDistance = bin.outputProgress * (
        OUTPUT_DROP_LENGTH + OUTPUT_LANE_END_X - OUTPUT_LANE_START_X
      );
      const isOnDrop = outputDistance < OUTPUT_DROP_LENGTH;
      const x = isOnDrop
        ? OUTPUT_LANE_START_X
        : OUTPUT_LANE_START_X + outputDistance - OUTPUT_DROP_LENGTH;
      const y = isOnDrop
        ? track.bottomY + outputDistance
        : OUTPUT_LANE_Y;
      drawBin(ctx, x, y, bin);
    }
  }

  for (const station of engine.stations) drawOperator(ctx, station);
  drawLabels(ctx, engine);
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = '#e6e9e2';
  ctx.lineWidth = 0.7;
  for (let x = 20; x < 1360; x += 25) {
    for (let y = 20; y < 720; y += 25) {
      ctx.beginPath();
      ctx.arc(x, y, 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStation(ctx: CanvasRenderingContext2D, station: Station, engine: SimulationEngine) {
  const { startX, endX, laneY } = station;
  const cardX = startX - 36;
  const cardY = 33;
  const cardW = endX - startX + 72;
  const load = station.bins.length;

  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, 284, 8);
  ctx.fillStyle = '#fbfcf8';
  ctx.fill();
  ctx.strokeStyle = '#dce2d9';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = station.id === 0 ? '#247a71' : '#b87436';
  ctx.fillRect(cardX + 1, cardY + 1, 3, 282);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 9px "DM Mono", monospace';
  ctx.fillText(`WERKSTATION 0${station.id + 1}`, cardX + 15, 54);
  ctx.fillStyle = load >= 8 ? COLORS.orange : COLORS.ink;
  ctx.font = '500 9px "DM Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${String(load).padStart(2, '0')} / 10 BAKKEN`, cardX + cardW - 14, 54);
  ctx.textAlign = 'left';

  const vlmY = 112;
  for (let index = 0; index < 3; index += 1) {
    const x = startX + 22 + index * 101;
    drawVlm(ctx, x, vlmY, index + 1, station.operator.vlmIndex === index && station.operator.phase === 'at-vlm');
  }

  const operator = station.operator;
  const operatorY = 286;
  ctx.strokeStyle = '#d8ded7';
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(startX + 38, operatorY + 8);
  ctx.lineTo(endX - 18, operatorY + 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#75817b';
  ctx.font = '400 8px "DM Sans", sans-serif';
  ctx.fillText('OPERATORZONE', startX + 5, operatorY + 27);
  drawLane(ctx, startX - 18, laneY, endX - startX + 36, 34, 10);
  for (let index = 0; index < 10; index += 1) {
    const x = startX + 30 + index * 31;
    const binAtSlot = station.bins
      .map((id) => engine.getStationBin(station, id))
      .find((bin) => bin?.slot === index);
    const isActive = station.operator.phase === 'to-bin'
      && station.operator.elapsed > 0
      && station.operator.targetBinId === binAtSlot?.id
      && binAtSlot?.mode === 'station';
    const lightY = laneY - 29;
    ctx.beginPath();
    ctx.arc(x, lightY, 5.1, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#f3b944' : '#d7ded6';
    ctx.fill();
    ctx.strokeStyle = isActive ? '#d59327' : '#c4cec4';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (isActive) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(x, lightY, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#f0ae35';
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.fillStyle = '#7d8982';
  ctx.font = '400 8px "DM Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PUT-TO-LIGHT  /  10 POSITIES', (startX + endX) / 2, laneY + 51);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawVlm(ctx: CanvasRenderingContext2D, x: number, y: number, number: number, active: boolean) {
  ctx.save();
  roundRect(ctx, x, y, 79, 88, 4);
  ctx.fillStyle = active ? '#e6eee8' : '#e9ede8';
  ctx.fill();
  ctx.strokeStyle = active ? '#9dbbad' : '#d2d9d1';
  ctx.lineWidth = 1;
  ctx.stroke();
  roundRect(ctx, x + 8, y + 9, 63, 63, 2);
  ctx.fillStyle = active ? '#cbded2' : '#d9dfd8';
  ctx.fill();
  ctx.strokeStyle = '#c1ccc2';
  ctx.stroke();
  ctx.fillStyle = '#84918a';
  ctx.font = '500 7px "DM Mono", monospace';
  ctx.fillText(`MODULA 0${number}`, x + 7, y + 82);
  ctx.fillStyle = '#7e8b84';
  for (let shelf = 0; shelf < 5; shelf += 1) {
    const shelfY = y + 19 + shelf * 10;
    ctx.fillRect(x + 15, shelfY, 49, 2);
    ctx.fillStyle = ['#c69363', '#92b4a1', '#d7a257', '#8ca7a0', '#c58d67'][shelf];
    ctx.fillRect(x + 20 + (shelf % 2) * 9, shelfY - 5, 10, 5);
    ctx.fillRect(x + 40 + (shelf % 3) * 4, shelfY - 5, 12, 5);
    ctx.fillStyle = '#7e8b84';
  }
  ctx.fillStyle = active ? COLORS.teal : '#aab5ac';
  ctx.beginPath();
  ctx.arc(x + 68, y + 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLane(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, count: number) {
  roundRect(ctx, x, y - height / 2, width, height, 5);
  ctx.fillStyle = COLORS.track;
  ctx.fill();
  ctx.strokeStyle = COLORS.trackEdge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - height / 2, width, height);
  ctx.clip();
  ctx.strokeStyle = '#839088';
  ctx.lineWidth = 2.5;
  for (let index = 0; index < count; index += 1) {
    const rollerX = x + 15 + index * ((width - 30) / (count - 1));
    ctx.beginPath();
    ctx.moveTo(rollerX, y - height / 2 + 2);
    ctx.lineTo(rollerX, y + height / 2 - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMainLoop(ctx: CanvasRenderingContext2D, engine: SimulationEngine) {
  const track = getTrackLayout();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(track.startX, track.topY);
  ctx.lineTo(track.endX, track.topY);
  ctx.arc(track.endX, (track.topY + track.bottomY) / 2, track.radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(track.startX, track.bottomY);
  ctx.arc(track.startX, (track.topY + track.bottomY) / 2, track.radius, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  ctx.lineWidth = 42;
  ctx.strokeStyle = '#dce1da';
  ctx.stroke();
  ctx.lineWidth = 29;
  ctx.strokeStyle = COLORS.track;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.trackEdge;
  ctx.stroke();

  const point = (distance: number) => getMainPosition(distance);
  for (let distance = 0; distance < track.loopLength; distance += 25) {
    const position = point(distance);
    const tangent = point(distance + 1);
    const angle = Math.atan2(tangent.y - position.y, tangent.x - position.x);
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#89958e';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();
  }

  drawArrow(ctx, 672, track.topY, 1);
  drawArrow(ctx, 672, track.bottomY, -1);
  for (const station of engine.stations) {
    ctx.fillStyle = station.id === 0 ? '#247a71' : '#b87436';
    ctx.beginPath();
    ctx.arc(station.startX + 24, track.topY, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.arc(795, track.bottomY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFeed(ctx: CanvasRenderingContext2D) {
  const x = 32;
  const y = 448;
  drawLane(ctx, x, y, 201, 37, 7);
  drawArrow(ctx, 195, y, 1);
  ctx.fillStyle = COLORS.teal;
  ctx.font = '500 8px "DM Mono", monospace';
  ctx.fillText('WACHTRIJ / LEGE BAKKEN', x + 2, y - 31);
  ctx.fillStyle = '#829087';
  ctx.font = '400 8px "DM Sans", sans-serif';
  ctx.fillText('aanvoer', x + 5, y + 33);
}

function drawOutput(ctx: CanvasRenderingContext2D) {
  drawLane(
    ctx,
    OUTPUT_LANE_START_X - 10,
    OUTPUT_LANE_Y,
    OUTPUT_LANE_END_X - OUTPUT_LANE_START_X + 20,
    37,
    13,
  );
  ctx.save();
  ctx.strokeStyle = '#e5a17f';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(OUTPUT_LANE_START_X, 660);
  ctx.lineTo(OUTPUT_LANE_START_X, OUTPUT_LANE_Y);
  ctx.stroke();
  ctx.restore();
  drawArrow(ctx, 970, OUTPUT_LANE_Y, 1);
  ctx.fillStyle = COLORS.orange;
  ctx.font = '500 8px "DM Mono", monospace';
  ctx.fillText('AFVOER / GEREED', OUTPUT_LANE_END_X + 18, 710);
}

function drawTransferPaths(ctx: CanvasRenderingContext2D, stations: [Station, Station]) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 7;
  for (const station of stations) {
    ctx.strokeStyle = station.id === 0 ? '#91b9a6' : '#d4a06e';
    ctx.beginPath();
    ctx.moveTo(station.startX + 24, station.laneY + 18);
    ctx.lineTo(station.startX + 24, 470);
    ctx.moveTo(station.endX - 8, station.laneY + 18);
    ctx.lineTo(station.endX - 8, 470);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBin(ctx: CanvasRenderingContext2D, x: number, y: number, bin: Bin) {
  const color = bin.processed ? COLORS.orange : bin.targetStation === 0 ? '#d2a052' : '#72a28b';
  ctx.save();
  ctx.shadowColor = '#17282327';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x - 12, y - 9, 24, 18, 3);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#fff9';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#fff9';
  ctx.fillRect(x - 7, y - 4, 14, 2);
  ctx.fillRect(x - 5, y + 1, 10, 2);
  ctx.restore();
}

function drawOperator(ctx: CanvasRenderingContext2D, station: Station) {
  const operator = station.operator;
  if (operator.phase === 'to-bin' || operator.phase === 'to-vlm') {
    ctx.save();
    ctx.strokeStyle = '#75958877';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(operator.x, operator.y + 10);
    ctx.lineTo(operator.targetX, operator.targetY + 10);
    ctx.stroke();
    ctx.restore();
  }
  drawOperatorFigure(
    ctx,
    operator.x,
    operator.y,
    station.id,
    operator.phase === 'to-bin' || operator.phase === 'to-vlm',
  );
}

function drawOperatorFigure(ctx: CanvasRenderingContext2D, x: number, y: number, stationId: number, walking: boolean) {
  const tint = stationId === 0 ? '#247a71' : '#b87436';
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f2c8a8';
  ctx.beginPath();
  ctx.arc(0, -12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint;
  roundRect(ctx, -5, -6, 10, 13, 3);
  ctx.fill();
  ctx.strokeStyle = '#51625b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const swing = walking ? Math.sin(Date.now() / 100) * 4 : 0;
  ctx.moveTo(-2, 7); ctx.lineTo(-4 + swing, 13);
  ctx.moveTo(2, 7); ctx.lineTo(4 - swing, 13);
  ctx.moveTo(-4, -2); ctx.lineTo(-8 - swing, 3);
  ctx.moveTo(4, -2); ctx.lineTo(8 + swing, 3);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 1 | -1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  ctx.fillStyle = '#c6cec6';
  ctx.beginPath();
  ctx.moveTo(-6, -4); ctx.lineTo(1, 0); ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D, engine: SimulationEngine) {
  ctx.save();
  ctx.fillStyle = '#64716a';
  ctx.font = '500 8px "DM Mono", monospace';
  ctx.fillText('HOOFDLOOP  /  ROLLENBAAN', 492, 520);
  ctx.fillStyle = COLORS.orange;
  ctx.fillText('UITSLUIZER 03', 824, 625);
  ctx.fillStyle = '#77827c';
  ctx.font = '400 8px "DM Sans", sans-serif';
  ctx.fillText(engine.running ? 'Systeem actief' : 'Systeem gepauzeerd', 1254, 688);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
