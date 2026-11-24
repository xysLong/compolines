/* ---------- state ---------- */
let canvas, ctx, container, image;
let imgW = 0, imgH = 0;                // natural image size
let scale = 1, offsetX = 0, offsetY = 0;

let currentMode = 'straight';          // 'straight' | 'curved'
let lines = [];                        // finished lines, image coordinates
let isDrawing = false;
let startPt = null;                    // straight mode: start point, image coordinates
let dragEnd = null;                    // straight mode: current pointer, image coordinates
let freehandPts = [];                  // curved mode: sampled stroke, image coordinates

const YELLOW = '#FFD600';
const YELLOW_ALPHA = 'rgba(255,214,0,0.5)';
const LINE_WIDTH = 2.5;
const LINE_WIDTH_LIVE = 1.5;
const ENDPOINT_RADIUS = 4;
const MIN_LENGTH = 2;                  // px in image space; shorter strokes are taps and are ignored

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('drawing-canvas');
    ctx = canvas.getContext('2d');
    container = document.getElementById('canvas-container');

    image = new Image();
    image.onload = () => {
        imgW = image.naturalWidth;
        imgH = image.naturalHeight;
        resizeCanvas();
    };
    image.src = STIMULUS_URL;

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
});

/* ---------- layout ---------- */
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (imgW && imgH) {
        scale = Math.min(w / imgW, h / imgH);
        offsetX = (w - imgW * scale) / 2;
        offsetY = (h - imgH * scale) / 2;
    }
    redraw();
}

function toImg(css) {
    return { x: (css.x - offsetX) / scale, y: (css.y - offsetY) / scale };
}

function toCss(x, y) {
    return { x: x * scale + offsetX, y: y * scale + offsetY };
}

function pointerCss(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function clampToImage(p) {
    return { x: Math.max(0, Math.min(imgW, p.x)), y: Math.max(0, Math.min(imgH, p.y)) };
}

function insideImage(p) {
    return p.x >= 0 && p.x <= imgW && p.y >= 0 && p.y <= imgH;
}

/* ---------- rendering ---------- */
function redraw() {
    ctx.clearRect(0, 0, container.clientWidth, container.clientHeight);
    if (image.complete && imgW) {
        ctx.drawImage(image, offsetX, offsetY, imgW * scale, imgH * scale);
    }
    for (const line of lines) {
        drawLine(line);
    }
    drawPreview();
}

function drawLine(line) {
    const p0 = toCss(line.x0, line.y0);
    const p1 = toCss(line.x1, line.y1);
    const c1 = toCss(line.cx1, line.cy1);
    const c2 = toCss(line.cx2, line.cy2);

    ctx.beginPath();
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p1.x, p1.y);
    ctx.stroke();

    ctx.fillStyle = YELLOW;
    drawDot(p0);
    drawDot(p1);
}

function drawDot(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
}

function drawPreview() {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.strokeStyle = YELLOW_ALPHA;
    ctx.lineWidth = LINE_WIDTH_LIVE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentMode === 'straight' && startPt && dragEnd) {
        const a = toCss(startPt.x, startPt.y);
        const b = toCss(dragEnd.x, dragEnd.y);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = YELLOW_ALPHA;
        drawDot(a);
    } else if (currentMode === 'curved' && freehandPts.length > 1) {
        const first = toCss(freehandPts[0].x, freehandPts[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < freehandPts.length; i++) {
            const p = toCss(freehandPts[i].x, freehandPts[i].y);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }
}

/* ---------- pointer events ---------- */
function onPointerDown(e) {
    e.preventDefault();
    if (e.button !== undefined && e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);

    const p = toImg(pointerCss(e));
    if (!insideImage(p)) return;

    isDrawing = true;
    if (currentMode === 'straight') {
        startPt = p;
        dragEnd = p;
    } else {
        freehandPts = [p];
    }
}

function onPointerMove(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const p = clampToImage(toImg(pointerCss(e)));
    if (currentMode === 'straight') {
        dragEnd = p;
    } else {
        freehandPts.push(p);
    }
    redraw();
}

function onPointerUp(e) {
    e.preventDefault();
    if (!isDrawing) return;
    isDrawing = false;
    const p = clampToImage(toImg(pointerCss(e)));
    const timestamp = new Date().toISOString();

    if (currentMode === 'straight') {
        if (startPt && Math.hypot(p.x - startPt.x, p.y - startPt.y) > MIN_LENGTH) {
            // a straight line is the degenerate Bézier whose handles sit on its endpoints
            lines.push({ mode: 'straight',
                         x0: startPt.x, y0: startPt.y, cx1: startPt.x, cy1: startPt.y,
                         cx2: p.x, cy2: p.y, x1: p.x, y1: p.y, timestamp });
        }
        startPt = null;
        dragEnd = null;
    } else {
        freehandPts.push(p);
        const bezier = fitCubicBezier(freehandPts);
        if (bezier) {
            lines.push({ mode: 'curved', ...bezier, timestamp });
        }
        freehandPts = [];
    }
    redraw();
}

function onPointerCancel() {
    isDrawing = false;
    startPt = null;
    dragEnd = null;
    freehandPts = [];
    redraw();
}

/* ---------- cubic Bézier fit ---------- */
/* Least-squares fit of one cubic Bézier to a point sequence with fixed endpoints.
   Chord-length parameterization; the two inner control points solve the 2x2 normal equations. */
function fitCubicBezier(points) {
    const n = points.length;
    if (n < 2) return null;
    const p0 = points[0];
    const p3 = points[n - 1];
    if (Math.hypot(p3.x - p0.x, p3.y - p0.y) <= MIN_LENGTH && n < 4) return null;

    const thirds = {
        cx1: p0.x + (p3.x - p0.x) / 3, cy1: p0.y + (p3.y - p0.y) / 3,
        cx2: p0.x + 2 * (p3.x - p0.x) / 3, cy2: p0.y + 2 * (p3.y - p0.y) / 3
    };
    if (n === 2) return { x0: p0.x, y0: p0.y, ...thirds, x1: p3.x, y1: p3.y };

    const chord = [0];
    for (let i = 1; i < n; i++) {
        chord.push(chord[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const total = chord[n - 1];
    const ts = total < 1e-6 ? points.map((_, i) => i / (n - 1)) : chord.map(c => c / total);

    // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
    let c00 = 0, c01 = 0, c11 = 0, bx0 = 0, bx1 = 0, by0 = 0, by1 = 0;
    for (let i = 0; i < n; i++) {
        const t = ts[i], mt = 1 - t;
        const a1 = 3 * mt * mt * t;
        const a2 = 3 * mt * t * t;
        const rx = points[i].x - mt * mt * mt * p0.x - t * t * t * p3.x;
        const ry = points[i].y - mt * mt * mt * p0.y - t * t * t * p3.y;
        c00 += a1 * a1; c01 += a1 * a2; c11 += a2 * a2;
        bx0 += a1 * rx; bx1 += a2 * rx;
        by0 += a1 * ry; by1 += a2 * ry;
    }
    const det = c00 * c11 - c01 * c01;
    if (Math.abs(det) < 1e-10) return { x0: p0.x, y0: p0.y, ...thirds, x1: p3.x, y1: p3.y };

    return {
        x0: p0.x, y0: p0.y,
        cx1: (c11 * bx0 - c01 * bx1) / det, cy1: (c11 * by0 - c01 * by1) / det,
        cx2: (c00 * bx1 - c01 * bx0) / det, cy2: (c00 * by1 - c01 * by0) / det,
        x1: p3.x, y1: p3.y
    };
}

/* ---------- controls ---------- */
function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-straight').classList.toggle('active', mode === 'straight');
    document.getElementById('btn-curved').classList.toggle('active', mode === 'curved');
}

function undoLine() {
    lines.pop();
    redraw();
}

function clearAll() {
    if (lines.length === 0) return;
    if (!confirm('Alle Linien auf diesem Bild löschen? / Remove all lines on this image?')) return;
    lines = [];
    redraw();
}

function nextImage() {
    if (lines.length === 0) return;
    fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines })
    })
        .then(r => r.json())
        .then(data => { if (data.redirect) window.location.href = data.redirect; })
        .catch(err => alert('Error saving data: ' + err));
}
