import { HAZARD_TYPE, ROCK_SIZE, WHIRLPOOL_SPIN } from "../game/constants.js";

const SHIP_COLORS = {
  P1: "#32d5d7",
  P2: "#ffb84a",
};

function facingAngle(facing) {
  switch (facing) {
    case "N":
      return -Math.PI / 2;
    case "E":
      return 0;
    case "S":
      return Math.PI / 2;
    case "W":
      return Math.PI;
    default:
      return 0;
  }
}

export class Renderer2D {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = grid;
    this.cell = Math.floor(Math.min(canvas.width / grid.width, canvas.height / grid.height));
    this.offsetX = Math.floor((canvas.width - this.cell * grid.width) / 2);
    this.offsetY = Math.floor((canvas.height - this.cell * grid.height) / 2);
  }

  gridToPixel(x, y) {
    return {
      px: this.offsetX + x * this.cell,
      py: this.offsetY + y * this.cell,
    };
  }

  drawGrid() {
    const { ctx, cell, grid, offsetX, offsetY } = this;
    ctx.fillStyle = "#082436";
    ctx.fillRect(offsetX, offsetY, grid.width * cell, grid.height * cell);

    ctx.strokeStyle = "rgba(98, 167, 206, 0.25)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= grid.width; x += 1) {
      const gx = offsetX + x * cell;
      ctx.beginPath();
      ctx.moveTo(gx, offsetY);
      ctx.lineTo(gx, offsetY + grid.height * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= grid.height; y += 1) {
      const gy = offsetY + y * cell;
      ctx.beginPath();
      ctx.moveTo(offsetX, gy);
      ctx.lineTo(offsetX + grid.width * cell, gy);
      ctx.stroke();
    }
  }

  drawHazards(grid) {
    const { ctx, cell } = this;
    if (!grid) {
      return;
    }

    if (Array.isArray(grid.rocks)) {
      for (const rock of grid.rocks) {
        const { px, py } = this.gridToPixel(rock.x, rock.y);
        const cx = px + cell / 2;
        const cy = py + cell / 2;
        const radius = rock.size === ROCK_SIZE.LARGE ? cell * 0.34 : cell * 0.22;
        ctx.fillStyle = rock.size === ROCK_SIZE.LARGE ? "#384453" : "#5a6b78";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (Array.isArray(grid.hazards)) {
      for (const hazard of grid.hazards) {
        const { px, py } = this.gridToPixel(hazard.x, hazard.y);
        const cx = px + cell / 2;
        const cy = py + cell / 2;
        if (hazard.type === HAZARD_TYPE.WIND) {
          const vec =
            hazard.dir === "E"
              ? { x: 1, y: 0 }
              : hazard.dir === "W"
                ? { x: -1, y: 0 }
                : hazard.dir === "N"
                  ? { x: 0, y: -1 }
                  : { x: 0, y: 1 };
          const length = cell * 0.46;
          const head = cell * 0.22;
          const tail = cell * 0.22;
          const lineEnd = length - head * 0.55;

          ctx.lineWidth = Math.max(1, Math.floor(cell * 0.1));
          ctx.strokeStyle = "rgba(120, 230, 238, 0.95)";
          ctx.beginPath();
          ctx.moveTo(cx - vec.x * tail, cy - vec.y * tail);
          ctx.lineTo(cx + vec.x * lineEnd, cy + vec.y * lineEnd);
          ctx.stroke();

          ctx.fillStyle = "rgba(150, 250, 255, 0.95)";
          ctx.beginPath();
          ctx.moveTo(cx + vec.x * length, cy + vec.y * length);
          ctx.lineTo(
            cx + vec.x * (length - head) + vec.y * head * 0.85,
            cy + vec.y * (length - head) - vec.x * head * 0.85,
          );
          ctx.lineTo(
            cx + vec.x * (length - head) - vec.y * head * 0.85,
            cy + vec.y * (length - head) + vec.x * head * 0.85,
          );
          ctx.closePath();
          ctx.fill();
        } else if (hazard.type === HAZARD_TYPE.WHIRLPOOL) {
          const size = hazard.size || 2;
          const width = cell * size;
          const height = cell * size;
          const centerX = px + width / 2;
          const centerY = py + height / 2;
          const radius = Math.min(width, height) * 0.36;
          const clockwise = (hazard.spin || WHIRLPOOL_SPIN.CW) === WHIRLPOOL_SPIN.CW;
          const startAngle = clockwise ? 0 : Math.PI;
          const endAngle = clockwise ? Math.PI * 1.6 : Math.PI * -0.6;
          const arcGap = 0.0;
          const arcStart = clockwise ? startAngle + arcGap : startAngle;
          const arcEnd = clockwise ? endAngle : endAngle + arcGap;

          ctx.strokeStyle = "rgba(170, 190, 255, 0.95)";
          ctx.lineWidth = Math.max(2, Math.floor(cell * 0.16));
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, arcStart, arcEnd, !clockwise);
          ctx.stroke();

          ctx.strokeStyle = "rgba(110, 135, 230, 0.7)";
          ctx.lineWidth = Math.max(1, Math.floor(cell * 0.08));
          ctx.beginPath();
          const innerStart = arcStart + 0.4;
          const innerEnd = arcEnd + 0.4;
          ctx.arc(centerX, centerY, radius * 0.6, innerStart, innerEnd, !clockwise);
          ctx.stroke();

          const arrowAngle = arcEnd;
          const tangentAngle = clockwise ? arrowAngle + Math.PI / 2 : arrowAngle - Math.PI / 2;
          const arrowOffset = cell * 0.12;
          const arrowX =
            centerX + Math.cos(arrowAngle) * radius + Math.cos(tangentAngle) * arrowOffset;
          const arrowY =
            centerY + Math.sin(arrowAngle) * radius + Math.sin(tangentAngle) * arrowOffset;
          const head = cell * 0.28;
          const wing = cell * 0.18;

          ctx.fillStyle = "rgba(205, 225, 255, 0.98)";
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - Math.cos(tangentAngle) * head + Math.cos(arrowAngle) * wing,
            arrowY - Math.sin(tangentAngle) * head + Math.sin(arrowAngle) * wing,
          );
          ctx.lineTo(
            arrowX - Math.cos(tangentAngle) * head - Math.cos(arrowAngle) * wing,
            arrowY - Math.sin(tangentAngle) * head - Math.sin(arrowAngle) * wing,
          );
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "rgba(90, 110, 200, 0.7)";
          ctx.lineWidth = Math.max(1, Math.floor(cell * 0.08));
          ctx.strokeRect(px + 1, py + 1, width - 2, height - 2);
        }
      }
    }
  }

  drawShip(ship) {
    const { ctx, cell } = this;
    const { px, py } = this.gridToPixel(ship.x, ship.y);
    const cx = px + cell / 2;
    const cy = py + cell / 2;
    const size = cell * 0.36;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(facingAngle(ship.facing));
    ctx.fillStyle = SHIP_COLORS[ship.id] || "#ffffff";
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.7);
    ctx.lineTo(-size * 0.7, size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#eaf8ff";
    ctx.font = `${Math.max(10, Math.floor(cell * 0.34))}px Trebuchet MS`;
    ctx.fillText(`HP:${ship.hp}`, px + 2, py + cell - 4);
  }

  drawTraces(traces) {
    const { ctx, cell } = this;
    if (!traces || traces.length === 0) {
      return;
    }

    const drawLine = (line, offsetX = 0, offsetY = 0) => {
      ctx.beginPath();
      line.forEach((tile, index) => {
        const { px, py } = this.gridToPixel(tile.x, tile.y);
        const x = px + cell / 2 + offsetX;
        const y = py + cell / 2 + offsetY;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    };

    for (const trace of traces) {
      const color = trace.kind === "grapple" ? "rgba(255, 220, 120, 0.8)" : "rgba(255, 110, 110, 0.75)";
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.floor(cell * 0.12));

      if (trace.kind === "shot" && trace.shots && trace.shots > 1 && trace.line.length > 0) {
        const first = trace.line[0];
        const last = trace.line[trace.line.length - 1];
        const dirX = Math.sign(last.x - first.x);
        const dirY = Math.sign(last.y - first.y);
        const perpX = dirY;
        const perpY = -dirX;
        const spacing = cell * 0.18;
        const centerIndex = (trace.shots - 1) / 2;
        for (let i = 0; i < trace.shots; i += 1) {
          const offset = (i - centerIndex) * spacing;
          drawLine(trace.line, perpX * offset, perpY * offset);
        }
      } else {
        drawLine(trace.line);
      }
    }
  }

  draw(matchState, overlay = {}) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawGrid();
    this.drawHazards(matchState.grid);
    for (const ship of matchState.ships) {
      if (ship.alive) {
        this.drawShip(ship);
      }
    }
    this.drawTraces(overlay.traces);
  }
}
