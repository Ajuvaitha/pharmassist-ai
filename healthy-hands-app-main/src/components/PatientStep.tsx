import { useMemo, useState } from "react";
import { Search, UserPlus, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/store";
import type { Patient } from "@/data/patients";
import { cn } from "@/lib/utils";

export function PatientCard({ patient, compact }: { patient: Patient; compact?: boolean }) {
  return (
    <div className="card-soft flex items-start gap-3 p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-base font-extrabold text-primary">
        {patient.name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">{patient.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {patient.id} · {patient.age}y · {patient.gender} · {patient.phone}
        </p>
        {!compact && patient.allergies && patient.allergies !== "None known" && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Allergy: {patient.allergies}
          </p>
        )}
      </div>
    </div>
  );
}

export function PatientStep({ onSelect }: { onSelect: (p: Patient) => void }) {
  const { patients, addPatient } = useApp();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "Female" as Patient["gender"],
    phone: "",
    allergies: "",
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [patients, query]);

  function register(e: React.FormEvent) {
    e.preventDefault();
    const created = addPatient({
      name: form.name,
      age: Number(form.age) || 0,
      gender: form.gender,
      phone: form.phone,
      allergies: form.allergies.trim() || "None known",
    });
    onSelect(created);
  }

  return (
    <div className="space-y-5">
      <div className="card-soft p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient by name or ID…"
            className="h-14 rounded-2xl pl-12 text-base"
          />
        </div>

        <div className="mt-4 space-y-2">
          {results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="font-semibold">No patient found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Register “{query}” as a new patient below.
              </p>
            </div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="tap-target flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/25 font-bold text-accent-foreground">
                {p.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{p.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {p.id} · {p.age}y · {p.gender}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <div className="card-soft p-4 sm:p-5">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Register new patient</span>
            <span className="block text-sm text-muted-foreground">
              Add name, age, gender, phone and allergies
            </span>
          </span>
          <ChevronRight
            className={cn("h-5 w-5 shrink-0 transition-transform", showForm && "rotate-90")}
          />
        </button>

        {showForm && (
          <form onSubmit={register} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="font-semibold">Full name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Priya Deshmukh"
                className="h-13 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Age</Label>
              <Input
                required
                inputMode="numeric"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="34"
                className="h-13 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Gender</Label>
              <div className="flex gap-2">
                {(["Female", "Male", "Other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm({ ...form, gender: g })}
                    className={cn(
                      "h-13 flex-1 rounded-xl border text-sm font-bold transition-colors",
                      form.gender === g
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Phone</Label>
              <Input
                required
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 90000 00000"
                className="h-13 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Known allergies</Label>
              <Input
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                placeholder="Penicillin, sulfa…"
                className="h-13 rounded-xl text-base"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" className="h-13 w-full rounded-xl text-base font-bold">
                Register & continue
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
