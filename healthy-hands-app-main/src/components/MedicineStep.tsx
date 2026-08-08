import { useCallback, useEffect, useState } from "react";
import { Search, Pill, X, Keyboard, PenLine, Sparkles, Layers, ExternalLink, Globe, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HandwritingPad } from "@/components/HandwritingPad";
import { VoiceAgent } from "@/components/VoiceAgent";
import { recognizeHandwriting } from "@/lib/handwriting";
import { useMedicineSearch } from "@/hooks/useMedicineSearch";
import { type Medicine, type MedicineMatch } from "@/data/medicines";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Web search helpers                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

interface WebSearchSite {
  name: string;
  color: string;
  url: (q: string) => string;
  emoji: string;
}

const SEARCH_SITES: WebSearchSite[] = [
  {
    name: "1mg",
    color: "hover:bg-red-50 hover:border-red-300 hover:text-red-700",
    url: (q) => `https://www.1mg.com/search/all?filter=true&name=${encodeURIComponent(q)}`,
    emoji: "💊",
  },
  {
    name: "PharmEasy",
    color: "hover:bg-green-50 hover:border-green-300 hover:text-green-700",
    url: (q) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}`,
    emoji: "🏥",
  },
  {
    name: "Netmeds",
    color: "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700",
    url: (q) => `https://www.netmeds.com/catalogsearch/result?q=${encodeURIComponent(q)}`,
    emoji: "💉",
  },
  {
    name: "Google",
    color: "hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700",
    url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q + " medicine dosage uses")}`,
    emoji: "🔍",
  },
];

function WebSearchPanel({ query }: { query: string }) {
  const q = query.trim();
  if (q.length < 2) return null;
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-3.5">
      <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        Search medicine online
      </p>
      <div className="flex flex-wrap gap-2">
        {SEARCH_SITES.map((site) => (
          <a
            key={site.name}
            href={site.url(q)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-all",
              site.color,
            )}
          >
            <span>{site.emoji}</span>
            {site.name}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Highlight matched text in suggestions                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function Highlight({ text, query }: { text: string; query: string }) {
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-accent/40 px-0.5 text-foreground">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function SuggestionRow({
  match,
  query,
  onSelect,
}: {
  match: MedicineMatch;
  query: string;
  onSelect: (m: Medicine, strength: string) => void;
}) {
  const m = match.medicine;
  return (
    <div
      onClick={() => onSelect(m, m.strength[0] ?? "")}
      className="cursor-pointer rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Pill className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">
            <Highlight text={m.genericName} query={match.matchedIn === "generic" ? query : ""} />
          </p>
          <p className="truncate text-sm text-muted-foreground">
            <Highlight text={match.brand} query={match.matchedIn === "brand" ? query : ""} /> ·{" "}
            {m.form} · {m.category}
          </p>
        </div>
        {/* Quick web search icon for this specific medicine */}
        <a
          href={`https://www.1mg.com/search/all?filter=true&name=${encodeURIComponent(m.genericName)}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Search ${m.genericName} on 1mg`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {m.strength.map((s) => (
          <button
            key={s}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(m, s);
            }}
            className="tap-target rounded-full border border-border bg-secondary px-4 text-sm font-bold text-secondary-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function RelatedSection({
  label,
  medicines,
  onSelect,
}: {
  label: string;
  medicines: Medicine[];
  onSelect: (m: Medicine, strength: string) => void;
}) {
  if (!medicines.length) return null;
  return (
    <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-border p-3.5">
      <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
        <Layers className="h-4 w-4" /> Related / Alternatives — {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {medicines.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m, m.strength[0] ?? "")}
            className="tap-target rounded-full border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            {m.genericName}
            <span className="ml-1 opacity-70">{m.strength[0] ?? ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


export function MedicineStep({
  onSelect,
  onAttachNote,
  noteCount = 0,
}: {
  onSelect: (m: Medicine, strength: string) => void;
  onAttachNote?: (dataUrl: string) => void;
  noteCount?: number;
}) {
  const [mode, setMode] = useState<"type" | "write" | "voice">("type");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  // ~200ms debounce
  useEffect(() => {
    if (!query.trim()) {
      setDebounced("");
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      setDebounced(query);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const { matches: results, related, relatedLabel, fuzzy: isFuzzy } = useMedicineSearch(debounced, 8);


  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1.5">
        <ModeBtn active={mode === "type"} onClick={() => setMode("type")}>
          <Keyboard className="h-5 w-5" /> Type
        </ModeBtn>
        <ModeBtn active={mode === "write"} onClick={() => setMode("write")}>
          <PenLine className="h-5 w-5" /> Write
        </ModeBtn>
        <ModeBtn active={mode === "voice"} onClick={() => setMode("voice")} highlight>
          <Mic className="h-5 w-5" /> Voice
        </ModeBtn>
      </div>

      {mode === "type" ? (
        <div className="card-soft p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTouched(true);
              }}
              placeholder="Search generic or brand name…"
              className="h-16 rounded-2xl pl-12 pr-12 text-lg font-semibold"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear"
                className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}

            {!loading && isFuzzy && (
              <p className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
                <Sparkles className="h-4 w-4" /> No exact match — closest matches for "{debounced}"
              </p>
            )}

            {!loading &&
              results.map((r) => (
                <SuggestionRow
                  key={`${r.medicine.id}-${r.brand}`}
                  match={r}
                  query={debounced}
                  onSelect={onSelect}
                />
              ))}

            {!loading && (
              <RelatedSection label={relatedLabel} medicines={related} onSelect={onSelect} />
            )}

            {/* ── Web search panel ── */}
            {debounced.length >= 2 && <WebSearchPanel query={debounced} />}

            {!loading && touched && debounced.trim() && results.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="font-semibold">No medicine matched "{debounced}"</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a shorter fragment like "cillin", "dolo" or "met", or search online ↓
                </p>
                <Button
                  variant="outline"
                  className="mt-4 h-12 rounded-xl font-bold"
                  onClick={() => setMode("write")}
                >
                  <PenLine className="mr-2 h-4 w-4" /> Write it instead
                </Button>
              </div>
            )}

            {!query.trim() && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <Pill className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">Start typing to search the formulary</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Matches anywhere in generic or brand names — "cillin" → Amoxicillin, "dolo" →
                  Paracetamol.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : mode === "write" ? (
        <WriteMode onSelect={onSelect} {...(onAttachNote ? { onAttachNote } : {})} noteCount={noteCount} />
      ) : (
        <VoiceAgent onSelect={onSelect} />
      )}
    </div>
  );
}

const WRITE_MAX_SUGGESTIONS = 6;

function WriteMode({
  onSelect,
  onAttachNote,
  noteCount,
}: {
  onSelect: (m: Medicine, strength: string) => void;
  onAttachNote?: (dataUrl: string) => void;
  noteCount: number;
}) {
  const [recognized, setRecognized] = useState("");
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [started, setStarted] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const { matches, related, relatedLabel } = useMedicineSearch(text, WRITE_MAX_SUGGESTIONS);

  // Live recognition on every writing pause — no minimum letter count.
  const handlePause = useCallback(
    async (dataUrl: string, ctx: { strokeCount: number; pointCount: number }) => {
      if (ctx.strokeCount === 0) {
        setRecognized("");
        setText("");
        setOcrError("");
        setStarted(false);
        setConfidence(undefined);
        return;
      }
      setStarted(true);
      setReading(true);
      try {
        const result = await recognizeHandwriting(dataUrl, ctx);
        if (result.error || !result.text) {
          setRecognized("");
          setOcrError("Couldn't recognize — try writing more clearly or use Type mode");
          setConfidence(undefined);
        } else {
          setOcrError("");
          setRecognized(result.text);
          setText(result.text);
          setConfidence(result.confidence);
        }
      } finally {
        setReading(false);
      }
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="card-soft space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Handwriting pad</h2>
          <p className="text-sm text-muted-foreground">
            Just start writing — suggestions refine after every short pause. Tap a medicine any time
            to jump straight to dosage.
          </p>
        </div>

        <HandwritingPad
          height={340}
          {...(onAttachNote ? { onAttach: onAttachNote } : {})}
          attachLabel="Attach as handwritten note"
          onStrokePause={handlePause}
          pauseMs={600}
          isRecognizing={reading}
        />

        {/* Recognition status bar */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            reading
              ? "animate-pulse bg-primary/10 text-primary"
              : recognized
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {reading
              ? "Recognizing handwriting…"
              : recognized
                ? `Recognized: "${recognized}"${confidence !== undefined ? ` (${Math.round(confidence)}% confidence)` : ""}`
                : "—"}
          </span>
        </div>

        {!reading && ocrError && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {ocrError}
          </p>
        )}

        <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
          <p className="text-sm font-semibold">Correct it if the reading is wrong:</p>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Amoxicillin"
            className="h-14 rounded-2xl text-base font-semibold"
          />
          <div className="space-y-2">
            {matches.map((r) => (
              <SuggestionRow
                key={`${r.medicine.id}-${r.brand}`}
                match={r}
                query={text}
                onSelect={onSelect}
              />
            ))}
            {matches.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm font-semibold text-muted-foreground">
                {started || text
                  ? "No matches yet — keep writing"
                  : "Start writing to see live suggestions"}
              </p>
            )}
            <RelatedSection label={relatedLabel} medicines={related} onSelect={onSelect} />
          </div>

          {/* Web search for whatever is in the text box */}
          {text.trim().length >= 2 && <WebSearchPanel query={text} />}
        </div>

        {noteCount > 0 && (
          <p className="text-sm font-semibold text-muted-foreground">
            {noteCount} handwritten {noteCount === 1 ? "note" : "notes"} attached to this
            prescription.
          </p>
        )}
      </div>
    </div>
  );
}


function ModeBtn({
  active,
  onClick,
  highlight = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-13 items-center justify-center gap-2 rounded-xl text-base font-bold transition-all duration-200",
        active
          ? highlight
            ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-card"
            : "bg-primary text-primary-foreground shadow-card"
          : highlight
            ? "text-primary hover:bg-primary/10 border border-primary/30"
            : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
