import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, FileText, ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrescriptionPreview } from "@/components/PrescriptionPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp, type Prescription } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Prescription History — Smart e-Prescription" },
      {
        name: "description",
        content: "Search and reopen every prescription issued to your patients.",
      },
      { property: "og:title", content: "Prescription History — Smart e-Prescription" },
      {
        property: "og:description",
        content: "Search and reopen every prescription issued to your patients.",
      },
    ],
  }),
  component: () => (
      <AppShell>
        <History />
      </AppShell>
  ),
});

function History() {
  const { prescriptions, patients } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Prescription | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prescriptions;
    return prescriptions.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.items.some((i) => i.medicineName.toLowerCase().includes(q)),
    );
  }, [prescriptions, query]);

  if (open) {
    const patient = patients.find((p) => p.id === open.patientId);
    return (
      <div className="space-y-5">
        <Button
          variant="ghost"
          className="no-print h-12 rounded-xl font-bold"
          onClick={() => setOpen(null)}
        >
          <ChevronLeft className="mr-1 h-5 w-5" /> Back to history
        </Button>
        {patient ? (
          <PrescriptionPreview prescription={open} patient={patient} />
        ) : (
          <p className="text-muted-foreground">Patient record unavailable.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Prescription history</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient, Rx ID or medicine…"
          className="h-14 rounded-2xl bg-card pl-12 text-base"
        />
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No prescriptions found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different patient or medicine.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((rx) => (
            <button
              key={rx.id}
              onClick={() => setOpen(rx)}
              className="card-soft grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-bold">{rx.patientName}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {rx.id} · {rx.items.map((i) => i.medicineName).join(", ")}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {new Date(rx.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                <span className="mt-1 block font-bold text-primary">
                  {rx.items.length} item{rx.items.length > 1 ? "s" : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
