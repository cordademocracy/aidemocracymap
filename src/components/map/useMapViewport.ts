import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const W = 1600;
const H = 1000;
/**
 * Visual center of the island artwork. The fractal coastline in IslandBase is
 * drawn at (880, 565) — see `fractalBlobPath(880, 565, ...)` and the GroundDetail
 * / IslandScatter fields, which all key off the same point. That's offset +80/+65
 * from the (800, 500) canvas center, so the view math centers THIS point, not the
 * canvas — otherwise the island reads shifted right and low on narrow viewports.
 */
const ISLAND_CX = 880;
const ISLAND_CY = 565;

/** Fit-to-container scale: the 1600x1000 canvas scaled to fit, with a small margin. */
function fitScale(w: number, h: number): number {
  return Math.min(w / W, h / H) * 0.98;
}

/**
 * Max zoom factor (view.k). Desktop keeps the classic cap of 4; but on small
 * screens base.k is tiny, so a flat 4 barely zooms in. Allow reaching an
 * effective scale (view.k * base.k) of ~2.4 on any device, never below 4.
 */
function maxZoom(baseK: number): number {
  return Math.max(4, 2.4 / baseK);
}

/** Pixel distance between two active touch points (for pinch-zoom). */
function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export interface ViewState {
  x: number;
  y: number;
  k: number;
}
interface Size {
  w: number;
  h: number;
}
export interface Base {
  k: number;
  x: number;
  y: number;
}

/** Lowest container-fill fraction at which the fits→overflow blend may begin. */
const BLEND_START = 0.85;

/**
 * Keep the panned/zoomed content inside the container. A canvas point px maps
 * to screen X = v.x + v.k*base.x + v.k*base.k*px. Below the blend band the
 * island center (ISLAND_CX/CY) is locked to the container center; above fill 1
 * panning is clamped against the canvas extents so neither edge leaves a gap;
 * inside the band the two candidate positions are linearly interpolated so
 * crossing the fit threshold never jumps. Pure — returns a new view.
 */
function clampView(v: ViewState, size: Size, base: Base): ViewState {
  const contentW = v.k * base.k * W;
  const contentH = v.k * base.k * H;

  const centeredX = size.w / 2 - v.k * base.x - v.k * base.k * ISLAND_CX;
  const rawMaxX = -v.k * base.x; // left edge flush at 0
  const rawMinX = size.w - contentW - v.k * base.x; // right edge flush at size.w
  // when contentW < size.w these are inverted (minX > maxX); order them so the
  // clamp is still well-defined — the ordered midpoint equals centeredX exactly
  // at contentW == size.w, so the blend has no seam at fill == 1
  const maxX = Math.max(rawMaxX, rawMinX);
  const minX = Math.min(rawMaxX, rawMinX);
  const clampedX = Math.min(maxX, Math.max(minX, v.x));

  const centeredY = size.h / 2 - v.k * base.y - v.k * base.k * ISLAND_CY;
  const rawMaxY = -v.k * base.y;
  const rawMinY = size.h - contentH - v.k * base.y;
  const maxY = Math.max(rawMaxY, rawMinY);
  const minY = Math.min(rawMaxY, rawMinY);
  const clampedY = Math.min(maxY, Math.max(minY, v.y));

  const fillX = contentW / size.w;
  const fillY = contentH / size.h;
  // the band never opens below the resting fill (v.k == 1), so the default view
  // stays exactly island-centered; fitScale's 0.98 margin bounds the start at
  // 0.98, keeping the band at least 0.02 wide on either axis
  const startX = Math.max(BLEND_START, (base.k * W) / size.w);
  const startY = Math.max(BLEND_START, (base.k * H) / size.h);
  const x = fillX <= startX ? centeredX : fillX >= 1 ? clampedX
    : centeredX + ((fillX - startX) / (1 - startX)) * (clampedX - centeredX);
  const y = fillY <= startY ? centeredY : fillY >= 1 ? clampedY
    : centeredY + ((fillY - startY) / (1 - startY)) * (clampedY - centeredY);

  return { k: v.k, x, y };
}

/** Debounce for gestures without a discrete end (wheel, zoom buttons). */
const SETTLE_MS = 160;

/**
 * Compositor-style pan/zoom (D9): during a gesture the scene `<g>` transform is
 * mutated directly through `sceneRef` (rAF-coalesced) with `will-change:
 * transform` held for the duration, so frames never touch React. React state
 * (`view`) is committed only when the gesture settles — for LOD, the editor and
 * anything else that reads the viewport.
 */
export function useMapViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SVGGElement>(null);

  const [view, setView] = useState<ViewState>(() => {
    // dev flag: /?zoom=1.8 starts zoomed (around the viewport center)
    const z = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("zoom")) : 0;
    // the container isn't measured yet — estimate its fit scale from the window so
    // the ?zoom cap matches the dynamic cap (maxZoom) used everywhere else
    const estBaseK =
      typeof window !== "undefined" ? fitScale(window.innerWidth, window.innerHeight) : fitScale(1200, 700);
    const k = z && !Number.isNaN(z) ? Math.min(maxZoom(estBaseK), Math.max(0.5, z)) : 1;
    return { x: (1 - k) * 800, y: (1 - k) * 470, k };
  });
  const [size, setSize] = useState<Size>({ w: 1200, h: 700 });

  // live view during a gesture; committed to React state only on settle
  const liveView = useRef(view);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const rafId = useRef(0);
  const lastScale = useRef(Number.NaN);
  const settleTimer = useRef(0);
  const gestureActive = useRef(false);
  // container rect, cached once per gesture (getBoundingClientRect forces layout)
  const gestureRect = useRef<DOMRect | null>(null);

  // mouse pan gesture
  const mouseDrag = useRef<{ startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(null);
  // active touch gesture: one-finger pan or two-finger pinch
  const touch = useRef<
    | { mode: "pan"; startX: number; startY: number; ox: number; oy: number; moved: boolean }
    | { mode: "pinch"; dist: number }
    | null
  >(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // fit the 1600x1000 canvas into the container, leaving a little margin
  const base = useMemo(() => {
    const k = fitScale(size.w, size.h);
    // center the ISLAND (880,565), not the canvas (800,500), so the artwork is
    // centered on every viewport instead of drifting right/low on narrow screens
    return { k, x: size.w / 2 - ISLAND_CX * k, y: size.h / 2 - ISLAND_CY * k };
  }, [size]);
  const baseRef = useRef(base);
  baseRef.current = base;

  /**
   * Live effective scale (view.k * base.k) as a CSS var for zoom-gated decor.
   * A custom property on the container invalidates the whole scene subtree, so
   * the write is skipped whenever the effective scale is unchanged — a pan
   * gesture must not invalidate anything.
   */
  const publishScale = useCallback(() => {
    const k = liveView.current.k * baseRef.current.k;
    if (k === lastScale.current || !containerRef.current) return;
    lastScale.current = k;
    containerRef.current.style.setProperty("--zoom-k", `${k}`);
  }, []);

  // rAF-coalesced write of the live transform straight to the DOM
  const applyLive = useCallback(() => {
    rafId.current = 0;
    const v = liveView.current;
    sceneRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.k})`);
    publishScale();
  }, [publishScale]);

  const scheduleApply = useCallback(() => {
    if (!gestureActive.current) {
      gestureActive.current = true;
      // compositor layer only while gesturing — a permanent will-change
      // keeps a stale raster (blurry when scaled) and costs memory
      if (sceneRef.current) sceneRef.current.style.willChange = "transform";
      // suppress per-node hover transforms/filters during gesture frames
      containerRef.current?.classList.add("map-gesturing");
    }
    if (!rafId.current) rafId.current = requestAnimationFrame(applyLive);
  }, [applyLive]);

  /** Gesture over: flush the pending frame, drop the layer, commit React state. */
  const settle = useCallback(() => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = 0;
    }
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      applyLive();
    }
    gestureActive.current = false;
    if (sceneRef.current) sceneRef.current.style.willChange = "";
    containerRef.current?.classList.remove("map-gesturing");
    publishScale();
    setView(liveView.current);
  }, [applyLive, publishScale]);

  const scheduleSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, SETTLE_MS);
  }, [settle]);

  // whenever the container (and thus base) changes, keep the view valid so a
  // window resize can't leave the content off-centre or gapped
  useEffect(() => {
    liveView.current = clampView(liveView.current, size, base);
    publishScale();
    setView(liveView.current);
  }, [size, base, publishScale]);

  // px/py (if given) are viewport clientX/Y — converted to container-local
  // coords, since view.x/y is container-local and the sticky Header offsets
  // the container from the window origin
  const zoomAt = useCallback(
    (factor: number, px?: number, py?: number) => {
      const v = liveView.current;
      const k = Math.min(maxZoom(baseRef.current.k), Math.max(0.5, v.k * factor));
      if (!gestureActive.current || !gestureRect.current)
        gestureRect.current = containerRef.current?.getBoundingClientRect() ?? null;
      const rect = gestureRect.current;
      const cx = px !== undefined ? px - (rect?.left ?? 0) : sizeRef.current.w / 2;
      const cy = py !== undefined ? py - (rect?.top ?? 0) : sizeRef.current.h / 2;
      const scale = k / v.k;
      liveView.current = clampView(
        { k, x: cx - (cx - v.x) * scale, y: cy - (cy - v.y) * scale },
        sizeRef.current,
        baseRef.current
      );
      scheduleApply();
      scheduleSettle();
    },
    [scheduleApply, scheduleSettle]
  );

  /**
   * Pan a canvas-space point inside the container, keeping `margin` px of slack
   * (keyboard focus must be visible — WCAG 2.4.11). Goes through the same ref
   * path as gestures: mutate liveView, flush the transform, then commit once.
   */
  const panIntoView = useCallback(
    (px: number, py: number, margin = 72) => {
      const v = liveView.current;
      const b = baseRef.current;
      const s = sizeRef.current;
      const sx = v.x + v.k * b.x + v.k * b.k * px;
      const sy = v.y + v.k * b.y + v.k * b.k * py;
      let dx = 0;
      let dy = 0;
      if (sx < margin) dx = margin - sx;
      else if (sx > s.w - margin) dx = s.w - margin - sx;
      if (sy < margin) dy = margin - sy;
      else if (sy > s.h - margin) dy = s.h - margin - sy;
      if (!dx && !dy) return;
      liveView.current = clampView({ ...v, x: v.x + dx, y: v.y + dy }, s, b);
      scheduleApply();
      settle();
    },
    [scheduleApply, settle]
  );

  /**
   * Put a canvas-space point at the container center at the current zoom
   * (deep-link restore). Same ref path as `panIntoView`: the synchronous
   * `settle()` flushes the transform before callers measure the DOM.
   */
  const centerOn = useCallback(
    (px: number, py: number) => {
      const v = liveView.current;
      const b = baseRef.current;
      const s = sizeRef.current;
      const sx = v.x + v.k * b.x + v.k * b.k * px;
      const sy = v.y + v.k * b.y + v.k * b.k * py;
      liveView.current = clampView(
        { ...v, x: v.x + (s.w / 2 - sx), y: v.y + (s.h / 2 - sy) },
        s,
        b
      );
      scheduleApply();
      settle();
    },
    [scheduleApply, settle]
  );

  const resetView = useCallback(() => {
    liveView.current = clampView({ x: 0, y: 0, k: 1 }, sizeRef.current, baseRef.current);
    settle();
  }, [settle]);

  /** Live effective scale (view.k * base.k) — valid mid-gesture. */
  const getScale = useCallback(() => liveView.current.k * baseRef.current.k, []);

  // --- mouse pan -------------------------------------------------------------

  const startMousePan = useCallback((e: React.MouseEvent) => {
    mouseDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: liveView.current.x,
      oy: liveView.current.y,
      moved: false,
    };
  }, []);

  const moveMousePan = useCallback(
    (e: React.MouseEvent) => {
      const d = mouseDrag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      liveView.current = clampView(
        { ...liveView.current, x: d.ox + dx, y: d.oy + dy },
        sizeRef.current,
        baseRef.current
      );
      scheduleApply();
    },
    [scheduleApply]
  );

  /** Ends a mouse pan; returns whether the pointer actually moved (vs a click). */
  const endMousePan = useCallback((): boolean => {
    const d = mouseDrag.current;
    mouseDrag.current = null;
    if (!d) return false;
    if (d.moved) settle();
    return d.moved;
  }, [settle]);

  // native non-passive wheel listener: zoom only, never scroll the page
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let wheelPeak = 0;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const magnitude = Math.abs(e.deltaY);
      if (!settleTimer.current) wheelPeak = magnitude;
      else if (magnitude > wheelPeak) wheelPeak = magnitude;
      // decaying trackpad momentum trails off as a fraction of this gesture's
      // peak delta — drop those tail events instead of letting them re-arm
      // the settle timer indefinitely; a deliberate slow scroll never dips
      // below its own (small) peak, so it's unaffected
      if (settleTimer.current && magnitude < wheelPeak * 0.05) return;
      // ctrlKey marks a trackpad pinch (synthesized as wheel by the browser),
      // which reports deltaY roughly an order of magnitude larger per gesture
      // unit than a plain wheel/two-finger scroll — d3-zoom uses the same 10x
      // split. Small coefficients keep both motions gentle.
      const coeff = e.ctrlKey ? 0.012 : 0.0012;
      const factor = Math.exp(-e.deltaY * coeff);
      zoomAt(factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [zoomAt]);

  // native non-passive touch listeners: one finger drags to pan (through the same
  // clampView as the mouse), two fingers pinch-zoom. We only preventDefault once a
  // gesture is clearly a pan/pinch, so a simple tap still reaches a node's click
  // handler and opens its tooltip.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touch.current = {
          mode: "pan",
          startX: t.clientX,
          startY: t.clientY,
          ox: liveView.current.x,
          oy: liveView.current.y,
          moved: false,
        };
      } else if (e.touches.length === 2) {
        // second finger down: (re)seed the pinch from the current spread so the
        // zoom doesn't jump when the gesture starts
        touch.current = { mode: "pinch", dist: touchDistance(e.touches[0], e.touches[1]) };
      }
    };
    const onMove = (e: TouchEvent) => {
      const st = touch.current;
      if (!st) return;
      if (st.mode === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = touchDistance(a, b);
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        if (st.dist > 0) zoomAt(dist / st.dist, midX, midY);
        st.dist = dist;
      } else if (st.mode === "pan" && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - st.startX;
        const dy = t.clientY - st.startY;
        if (Math.abs(dx) + Math.abs(dy) > 6) st.moved = true;
        if (st.moved) {
          e.preventDefault(); // claim the gesture so the page can't scroll/rubber-band
          liveView.current = clampView(
            { ...liveView.current, x: st.ox + dx, y: st.oy + dy },
            sizeRef.current,
            baseRef.current
          );
          scheduleApply();
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        const st = touch.current;
        // a plain tap never began a gesture — don't force a React commit for it
        if (st && (st.mode === "pinch" || st.moved)) settle();
        touch.current = null;
      } else if (e.touches.length === 1) {
        // dropped from two fingers to one: keep panning from the surviving finger
        const t = e.touches[0];
        touch.current = {
          mode: "pan",
          startX: t.clientX,
          startY: t.clientY,
          ox: liveView.current.x,
          oy: liveView.current.y,
          moved: true,
        };
      }
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [zoomAt, scheduleApply, settle]);

  return {
    containerRef,
    sceneRef,
    /** settled view — React re-renders only when a gesture ends */
    view,
    base,
    size,
    getScale,
    zoomAt,
    panIntoView,
    centerOn,
    resetView,
    startMousePan,
    moveMousePan,
    endMousePan,
  };
}
