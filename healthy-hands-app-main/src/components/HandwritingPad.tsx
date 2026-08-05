import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Undo2, Trash2, ScanText, Paperclip, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Stroke {
  points: { x: number; y: number }[];
  width: number;
  erase: boolean;
}

const WIDTHS = [2, 4, 7, 11];

/**
 * Canvas handwriting pad with pointer-event input (finger, stylus/Apple Pencil,
 * mouse). `onAttach` receives a PNG data URL of the note.
 * `recognizeText` is the pluggable OCR hook — swap the default stub for a real
 * handwriting-OCR call (Google Cloud Vision, ML Kit, …) later.
 */
export function HandwritingPad({
  height = 320,
  onAttach,
  attachLabel = "Attach handwritten note",
  onRecognized,
  recognizeText,
  onStrokePause,
  pauseMs = 550,
  isRecognizing = false,
}: {
  height?: number;
  onAttach?: (dataUrl: string) => void;
  attachLabel?: string;
  onRecognized?: (text: string, dataUrl: string) => void;
  recognizeText?: (dataUrl: string) => Promise<string>;
  /**
   * Fires after a short pause in writing (default ~550ms with no new stroke),
   * with the current canvas snapshot and stroke stats. Used for continuous
   * live recognition / suggestions. `strokeCount: 0` means the pad was cleared.
   */
  onStrokePause?: (dataUrl: string, ctx: { strokeCount: number; pointCount: number }) => void;
  pauseMs?: number;
  /** When true, shows an animated scanning border to indicate recognition in progress. */
  isRecognizing?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [erase, setErase] = useState(false);
  const [width, setWidth] = useState(4);
  const [isEmpty, setIsEmpty] = useState(true);


  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = drawingRef.current
      ? [...strokesRef.current, drawingRef.current]
      : strokesRef.current;
    for (const s of all) {
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      ctx.strokeStyle = "#0f2f45";
      ctx.lineWidth = s.erase ? s.width * 4 : s.width;
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.points.length === 1) ctx.lineTo(s.points[0]!.x + 0.1, s.points[0]!.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Keep the backing store in sync with the element size (and device pixels).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = { points: [pos(e)], width, erase };
    redraw();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const evts = typeof e.nativeEvent.getCoalescedEvents === "function"
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent];
    const rect = e.currentTarget.getBoundingClientRect();
    for (const ev of evts) {
      drawingRef.current.points.push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    }
    redraw();
  }

  // Debounced "pause in writing" notifier — fires once the pen has been still
  // for `pauseMs`, so recognition runs on pauses, not on every stroke.
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePause = useCallback(() => {
    if (!onStrokePause) return;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => {
      const strokeCount = strokesRef.current.length;
      const pointCount = strokesRef.current.reduce((n, s) => n + s.points.length, 0);
      const dataUrl = strokeCount ? exportPng() : "";
      onStrokePause(dataUrl ?? "", { strokeCount, pointCount });
    }, pauseMs);
  }, [onStrokePause, pauseMs]);

  useEffect(() => () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, []);

  function onUp() {
    if (drawingRef.current) {
      strokesRef.current = [...strokesRef.current, drawingRef.current];
      drawingRef.current = null;
      setIsEmpty(strokesRef.current.length === 0);
      redraw();
      schedulePause();
    }
  }

  function undo() {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setIsEmpty(strokesRef.current.length === 0);
    redraw();
    schedulePause();
  }

  function clear() {
    strokesRef.current = [];
    setIsEmpty(true);
    redraw();
    schedulePause();
  }


  /** Flatten onto ruled paper so the exported note looks like the pad. */
  function exportPng(): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#dbeafe";
    ctx.lineWidth = 1;
    for (let y = 32; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
    return out.toDataURL("image/png");
  }

  const [recognizing, setRecognizing] = useState(false);

  async function convert() {
    const dataUrl = exportPng();
    if (!dataUrl) return;
    setRecognizing(true);
    try {
      // OCR plug-point: default stub returns "" so the doctor confirms manually.
      const text = recognizeText ? await recognizeText(dataUrl) : "";
      onRecognized?.(text, dataUrl);
    } finally {
      setRecognizing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          <ToolBtn active={!erase} onClick={() => setErase(false)} label="Pen">
            <PenLine className="h-5 w-5" />
          </ToolBtn>
          <ToolBtn active={erase} onClick={() => setErase(true)} label="Eraser">
            <Eraser className="h-5 w-5" />
          </ToolBtn>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1.5">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Stroke
          </Label>
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Stroke width ${w}`}
              aria-pressed={width === w}
              onClick={() => setWidth(w)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl transition-colors",
                width === w ? "bg-primary/10" : "hover:bg-secondary",
              )}
            >
              <span
                className={cn("rounded-full", width === w ? "bg-primary" : "bg-muted-foreground")}
                style={{ width: w + 3, height: w + 3 }}
              />
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <ToolBtn onClick={undo} label="Undo" disabled={isEmpty}>
            <Undo2 className="h-5 w-5" />
          </ToolBtn>
          <ToolBtn onClick={clear} label="Clear" disabled={isEmpty}>
            <Trash2 className="h-5 w-5" />
          </ToolBtn>
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-card transition-all duration-300",
          isRecognizing
            ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.25)] animate-pulse"
            : "border-border",
        )}
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0 31px, hsl(var(--border) / 0.6) 31px 32px)",
        }}
      >
        {isRecognizing && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-1.5 bg-primary/10 py-1.5 text-xs font-bold text-primary">
            <Zap className="h-3 w-3 animate-bounce" />
            Reading handwriting…
          </div>
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
          style={{ height, touchAction: "none" }}
          className="block w-full cursor-crosshair"
          aria-label="Handwriting pad"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {onRecognized && (
          <Button
            type="button"
            onClick={convert}
            disabled={isEmpty || recognizing}
            size="lg"
            className="h-14 flex-1 rounded-2xl text-base font-bold"
          >
            <ScanText className="mr-2 h-5 w-5" /> {recognizing ? "Reading…" : "Convert to text"}
          </Button>
        )}
        {onAttach && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isEmpty}
            onClick={() => {
              const url = exportPng();
              if (url) {
                onAttach(url);
                clear();
              }
            }}
            className="h-14 flex-1 rounded-2xl text-base font-bold"
          >
            <Paperclip className="mr-2 h-5 w-5" /> {attachLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  label,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-12 w-12 place-items-center rounded-2xl border transition-colors disabled:opacity-40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
