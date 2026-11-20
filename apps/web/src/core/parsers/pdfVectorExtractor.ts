export interface VectorBarline {
  x: number;
  yMin: number;
  yMax: number;
}

export interface VectorBeam {
  x1: number;
  x2: number;
  y: number;
}

export interface VectorTie {
  x1: number;
  x2: number;
  y: number;
}

export interface VectorGeometry {
  barlines: VectorBarline[];
  beams: VectorBeam[];
  ties: VectorTie[];
}

type Matrix6 = [number, number, number, number, number, number];

function multiplyMatrix(m1: Matrix6, m2: Matrix6): Matrix6 {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix6, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Interprets a pdf.js page operator list (with full 2D CTM stack) to extract
 * musical vector primitives in PDF page coordinates:
 * - Barlines (vertical segments / thin vertical rects)
 * - Beams (horizontal or sloped parallelograms / thick rects)
 * - Ties (shallow Bezier arcs connecting same-pitch notes)
 */
export function extractVectorGeometryFromOps(
  fnArray: number[],
  argsArray: unknown[],
  ops: Record<string, number>,
): VectorGeometry {
  const barlines: VectorBarline[] = [];
  const beams: VectorBeam[] = [];
  const ties: VectorTie[] = [];

  let ctm: Matrix6 = [1, 0, 0, 1, 0, 0];
  const stack: Matrix6[] = [];

  let curX = 0;
  let curY = 0;
  let polyPts: Array<[number, number]> = [];

  const flushPolygon = () => {
    if (polyPts.length >= 3 && polyPts.length <= 6) {
      let xMin = Infinity;
      let xMax = -Infinity;
      let yMin = Infinity;
      let yMax = -Infinity;
      for (const [px, py] of polyPts) {
        if (px < xMin) xMin = px;
        if (px > xMax) xMax = px;
        if (py < yMin) yMin = py;
        if (py > yMax) yMax = py;
      }
      const w = xMax - xMin;
      const h = yMax - yMin;

      // Vertical barline polygon
      if (w <= 3.5 && h >= 16) {
        barlines.push({ x: (xMin + xMax) / 2, yMin, yMax });
      }
      // Horizontal or sloped beam parallelogram (MuseScore draws beams as 4-pt polygons)
      else if (w >= 6 && h >= 1.5 && h <= 24 && h / w < 0.6) {
        beams.push({ x1: xMin, x2: xMax, y: (yMin + yMax) / 2 });
      }
    }
    polyPts = [];
  };

function isNumericSequence(val: unknown): val is ArrayLike<number> {
  return Array.isArray(val) || ArrayBuffer.isView(val);
}

  const processPathOp = (op: number, coords: ArrayLike<number>, coordIdx: { i: number }) => {
    if (op === ops.closePath) {
      flushPolygon();
    } else if (op === ops.moveTo) {
      flushPolygon();
      const [x, y] = applyMatrix(ctm, coords[coordIdx.i++], coords[coordIdx.i++]);
      curX = x;
      curY = y;
      polyPts = [[x, y]];
    } else if (op === ops.lineTo) {
      const [x, y] = applyMatrix(ctm, coords[coordIdx.i++], coords[coordIdx.i++]);
      const dx = Math.abs(x - curX);
      const dy = Math.abs(y - curY);
      // Direct stroked vertical barline segment
      if (dx <= 2.5 && dy >= 16) {
        barlines.push({ x: (curX + x) / 2, yMin: Math.min(curY, y), yMax: Math.max(curY, y) });
      }
      polyPts.push([x, y]);
      curX = x;
      curY = y;
    } else if (op === ops.curveTo) {
      const [, cy1] = applyMatrix(ctm, coords[coordIdx.i++], coords[coordIdx.i++]);
      const [, cy2] = applyMatrix(ctm, coords[coordIdx.i++], coords[coordIdx.i++]);
      const [x3, y3] = applyMatrix(ctm, coords[coordIdx.i++], coords[coordIdx.i++]);
      const dx = Math.abs(x3 - curX);
      const dy = Math.abs(y3 - curY);
      const ctrlOffset = Math.max(Math.abs(cy1 - curY), Math.abs(cy2 - y3));
      // Tie / slur arc: spans horizontally between notes, ends at similar height, shallow vertical arch
      if (dx >= 8 && dx <= 180 && dy <= 10 && ctrlOffset >= 1.2 && ctrlOffset <= 24) {
        ties.push({
          x1: Math.min(curX, x3),
          x2: Math.max(curX, x3),
          y: (curY + y3) / 2,
        });
      }
      polyPts = [];
      curX = x3;
      curY = y3;
    } else if (op === ops.curveTo2 || op === ops.curveTo3) {
      coordIdx.i += 2;
      const [x3, y3] = applyMatrix(ctm, coords[coordIdx.i++], coords[coordIdx.i++]);
      polyPts = [];
      curX = x3;
      curY = y3;
    } else if (op === ops.rectangle) {
      flushPolygon();
      const rx = coords[coordIdx.i++];
      const ry = coords[coordIdx.i++];
      const rw = coords[coordIdx.i++];
      const rh = coords[coordIdx.i++];
      const [x1, y1] = applyMatrix(ctm, rx, ry);
      const [x2, y2] = applyMatrix(ctm, rx + rw, ry + rh);
      const xMin = Math.min(x1, x2);
      const xMax = Math.max(x1, x2);
      const yMin = Math.min(y1, y2);
      const yMax = Math.max(y1, y2);
      const w = xMax - xMin;
      const h = yMax - yMin;

      if (w <= 3.5 && h >= 16) {
        barlines.push({ x: (xMin + xMax) / 2, yMin, yMax });
      } else if (w >= 6 && h >= 1.5 && h <= 16 && h / w < 0.55) {
        beams.push({ x1: xMin, x2: xMax, y: (yMin + yMax) / 2 });
      }
    }
  };

  for (let idx = 0; idx < fnArray.length; idx++) {
    const fn = fnArray[idx];
    const args = argsArray[idx] as unknown[];

    if (fn === ops.save) {
      stack.push([...ctm]);
    } else if (fn === ops.restore) {
      flushPolygon();
      const prev = stack.pop();
      if (prev) ctm = prev;
    } else if (fn === ops.transform && isNumericSequence(args) && args.length >= 6) {
      ctm = multiplyMatrix(ctm, [args[0], args[1], args[2], args[3], args[4], args[5]]);
    } else if (fn === ops.constructPath && Array.isArray(args) && args.length >= 2) {
      const subOps = args[0];
      const subCoords = args[1];
      if (isNumericSequence(subOps) && isNumericSequence(subCoords)) {
        const coordIdx = { i: 0 };
        for (let k = 0; k < subOps.length; k++) {
          processPathOp(subOps[k], subCoords, coordIdx);
        }
        flushPolygon();
      }
    } else if (
      fn === ops.moveTo ||
      fn === ops.lineTo ||
      fn === ops.curveTo ||
      fn === ops.curveTo2 ||
      fn === ops.curveTo3 ||
      fn === ops.rectangle ||
      fn === ops.closePath
    ) {
      if (isNumericSequence(args)) {
        processPathOp(fn, args, { i: 0 });
      }
    }
  }
  flushPolygon();

  return { barlines, beams, ties };
}
