import { useState } from "react";
import { Minus, Plus, Sun, SunMoon, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FREQUENCIES, INSTRUCTION_CHIPS, type Medicine } from "@/data/medicines";
import type { PrescriptionItem } from "@/lib/store";
import { cn } from "@/lib/utils";

const FORMS = ["Tablet", "Syrup", "Capsule"] as const;
const FREQ_ICONS = [Sun, SunMoon, Clock] as const;

function Pillbtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap-target flex items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-card"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </Label>
      {children}
    </div>
  );
}

export function DosageStep({
  medicine,
  initialStrength,
  existing,
  onAdd,
  onCancel,
}: {
  medicine: Medicine;
  initialStrength: string;
  existing?: PrescriptionItem | undefined;
  onAdd: (item: PrescriptionItem) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<string>(existing?.form ?? medicine.form);
  const [strength, setStrength] = useState(existing?.strength ?? initialStrength);
  const [quantity, setQuantity] = useState(existing?.quantity ?? 10);
  const [freq, setFreq] = useState(existing?.frequency ?? FREQUENCIES[1].label);
  const [timing, setTiming] = useState<PrescriptionItem["timing"]>(
    existing?.timing ?? "After food",
  );
  const [days, setDays] = useState(String(existing?.durationDays ?? 5));
  const [instructions, setInstructions] = useState<string[]>(existing?.instructions ?? []);

  function toggleInstruction(chip: string) {
    setInstructions((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  }

  function submit() {
    const f = FREQUENCIES.find((x) => x.label === freq) ?? FREQUENCIES[0];
    onAdd({
      id: existing?.id ?? `it-${Date.now()}`,
      medicineName: medicine.name,
      brand: medicine.brand,
      form,
      strength,
      quantity,
      frequency: f.label,
      frequencyShort: f.short,
      timing,
      durationDays: Number(days) || 1,
      instructions,
    });
  }

  return (
    <div className="space-y-5">
      <div className="card-soft p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Prescribing
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
          {medicine.name} <span className="text-primary">{strength}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {medicine.brand} · {medicine.category}
        </p>
      </div>

      <div className="card-soft space-y-6 p-4 sm:p-5">
        <Section title="Dosage form">
          <div className="grid grid-cols-3 gap-2">
            {FORMS.map((f) => (
              <Pillbtn key={f} active={form === f} onClick={() => setForm(f)}>
                {f}
              </Pillbtn>
            ))}
          </div>
        </Section>

        <Section title="Strength">
          <div className="flex flex-wrap gap-2">
            {medicine.strengths.map((s) => (
              <Pillbtn key={s} active={strength === s} onClick={() => setStrength(s)}>
                {s}
              </Pillbtn>
            ))}
          </div>
        </Section>

        <Section title={`Quantity (${form.toLowerCase()}s)`}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card transition-colors hover:bg-secondary"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="min-w-16 text-center text-3xl font-extrabold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => q + 1)}
              className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card transition-colors hover:bg-secondary"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </Section>

        <Section title="Frequency">
          <div className="grid gap-2 sm:grid-cols-3">
            {FREQUENCIES.map((f, i) => {
              const Icon = FREQ_ICONS[i] ?? Sun;
              return (
                <Pillbtn key={f.label} active={freq === f.label} onClick={() => setFreq(f.label)}>
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{f.label}</span>
                  <span className="opacity-70">{f.short}</span>
                </Pillbtn>
              );
            })}
          </div>
        </Section>

        <Section title="Timing">
          <div className="grid grid-cols-2 gap-2">
            {(["Before food", "After food"] as const).map((t) => (
              <Pillbtn key={t} active={timing === t} onClick={() => setTiming(t)}>
                {t}
              </Pillbtn>
            ))}
          </div>
        </Section>

        <Section title="Duration">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={days}
              inputMode="numeric"
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
              className="h-13 w-28 rounded-xl text-center text-base font-bold"
            />
            <span className="mr-2 text-sm font-semibold text-muted-foreground">days</span>
            {[3, 5, 7, 10].map((d) => (
              <Pillbtn key={d} active={days === String(d)} onClick={() => setDays(String(d))}>
                {d}d
              </Pillbtn>
            ))}
          </div>
        </Section>

        <Section title="Quick instructions">
          <div className="flex flex-wrap gap-2">
            {INSTRUCTION_CHIPS.map((chip) => {
              const active = instructions.includes(chip);
              return (
                <Pillbtn key={chip} active={active} onClick={() => toggleInstruction(chip)}>
                  {active && <Check className="h-4 w-4" />}
                  {chip}
                </Pillbtn>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button onClick={submit} size="lg" className="h-14 flex-1 rounded-2xl text-base font-bold">
          {existing ? "Update medicine" : "Add medicine"}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl text-base font-bold sm:flex-none sm:px-8"
        >
          Back
        </Button>
      </div>
    </div>
  );
}
