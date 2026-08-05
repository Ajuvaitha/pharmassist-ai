import { Pencil, Trash2, Plus, CalendarDays, FileCheck2, PenLine } from "lucide-react";
import { HandwritingPad } from "@/components/HandwritingPad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrescriptionItem } from "@/lib/store";
import type { Patient } from "@/data/patients";
import { PatientCard } from "@/components/PatientStep";

export function ReviewStep({
  patient,
  items,
  notes,
  onAddNote,
  onRemoveNote,
  followUp,
  onFollowUpChange,
  onEdit,
  onRemove,
  onAddAnother,
  onFinalize,
}: {
  patient: Patient;
  items: PrescriptionItem[];
  notes: string[];
  onAddNote: (dataUrl: string) => void;
  onRemoveNote: (index: number) => void;
  followUp: string;
  onFollowUpChange: (v: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onAddAnother: () => void;
  onFinalize: () => void;
}) {
  return (
    <div className="space-y-5">
      <PatientCard patient={patient} />

      <div className="space-y-3">
        <h2 className="text-lg font-extrabold tracking-tight">
          Prescription ({items.length} {items.length === 1 ? "medicine" : "medicines"})
        </h2>

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-semibold">No medicines added yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Search the formulary to add the first medicine.
            </p>
          </div>
        )}

        {items.map((it) => (
          <div key={it.id} className="card-soft p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold">
                  {it.medicineName} {it.strength}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {it.brand} · {it.form} · Qty {it.quantity}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => onEdit(it.id)}
                  aria-label="Edit medicine"
                  className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onRemove(it.id)}
                  aria-label="Remove medicine"
                  className="grid h-11 w-11 place-items-center rounded-xl text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>{it.frequency} ({it.frequencyShort})</Chip>
              <Chip>{it.timing}</Chip>
              <Chip>{it.durationDays} days</Chip>
              {it.instructions.map((i) => (
                <Chip key={i} tone="accent">
                  {i}
                </Chip>
              ))}
            </div>
          </div>
        ))}

        <Button
          onClick={onAddAnother}
          variant="outline"
          size="lg"
          className="h-14 w-full rounded-2xl border-dashed text-base font-bold"
        >
          <Plus className="mr-1 h-5 w-5" /> Add another medicine
        </Button>
      </div>

      <div className="card-soft space-y-4 p-4 sm:p-5">
        <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <PenLine className="h-4 w-4" /> Handwritten notes
        </Label>
        {notes.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {notes.map((n, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-border">
                <img src={n} alt={`Handwritten note ${i + 1}`} className="block w-full" />
                <button
                  onClick={() => onRemoveNote(i)}
                  aria-label={`Remove handwritten note ${i + 1}`}
                  className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-xl bg-card/90 text-destructive shadow-card"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <HandwritingPad height={260} onAttach={onAddNote} attachLabel="Attach note" />
      </div>

      <div className="card-soft space-y-3 p-4 sm:p-5">
        <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Follow-up date
        </Label>
        <Input
          type="date"
          value={followUp}
          onChange={(e) => onFollowUpChange(e.target.value)}
          className="h-13 rounded-xl text-base"
        />
      </div>

      <Button
        onClick={onFinalize}
        disabled={items.length === 0}
        size="lg"
        className="h-15 w-full rounded-2xl text-base font-extrabold"
      >
        <FileCheck2 className="mr-2 h-5 w-5" /> Finalize prescription
      </Button>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "accent" }) {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded-lg bg-accent/25 px-2.5 py-1 text-xs font-bold text-accent-foreground"
          : "rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground"
      }
    >
      {children}
    </span>
  );
}
