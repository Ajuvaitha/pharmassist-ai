import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StepIndicator, type StepIndex } from "@/components/StepIndicator";
import { PatientCard, PatientStep } from "@/components/PatientStep";
import { MedicineStep } from "@/components/MedicineStep";
import { DosageStep } from "@/components/DosageStep";
import { ReviewStep } from "@/components/ReviewStep";
import { PrescriptionPreview } from "@/components/PrescriptionPreview";
import { Button } from "@/components/ui/button";
import { MEDICINES, type Medicine } from "@/data/medicines";
import type { Patient } from "@/data/patients";
import { useApp, type Prescription, type PrescriptionItem } from "@/lib/store";

export const Route = createFileRoute("/prescribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    patient: typeof search["patient"] === "string" ? (search["patient"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New Prescription — Smart e-Prescription" },
      {
        name: "description",
        content:
          "Pick a patient, search medicines with live auto-suggest, set dosage and finalize the e-prescription.",
      },
      { property: "og:title", content: "New Prescription — Smart e-Prescription" },
      {
        property: "og:description",
        content: "Search medicines with live auto-suggest and build a prescription in seconds.",
      },
    ],
  }),
  component: () => (
      <AppShell>
        <Prescribe />
      </AppShell>
  ),
});

function Prescribe() {
  const { patients, savePrescription } = useApp();
  const navigate = useNavigate();
  const { patient: patientParam } = Route.useSearch();

  const [patient, setPatient] = useState<Patient | null>(
    () => patients.find((p) => p.id === patientParam) ?? null,
  );
  const [step, setStep] = useState<StepIndex>(patientParam ? 1 : 0);
  const [draft, setDraft] = useState<{ medicine: Medicine; strength: string } | null>(null);
  const [editing, setEditing] = useState<PrescriptionItem | undefined>(undefined);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [finalized, setFinalized] = useState<Prescription | null>(null);
  const [saved, setSaved] = useState(false);

  function addItem(item: PrescriptionItem) {
    setItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.map((i) => (i.id === item.id ? item : i))
        : [...prev, item],
    );
    setDraft(null);
    setEditing(undefined);
    setStep(3);
    toast.success(`${item.medicineName} ${item.strength} added`);
  }

  function editItem(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const med =
      MEDICINES.find((m) => m.name === it.medicineName) ??
      ({
        id: "custom",
        name: it.medicineName,
        brand: it.brand,
        strengths: [it.strength],
        form: "Tablet",
        category: "",
      } as Medicine);
    setEditing(it);
    setDraft({ medicine: med, strength: it.strength });
    setStep(2);
  }

  if (finalized && patient) {
    return (
      <div className="space-y-5">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">e-Prescription ready</h1>
          <Button
            variant="outline"
            className="h-12 rounded-xl font-bold"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            Back to dashboard
          </Button>
        </div>
        <PrescriptionPreview
          prescription={finalized}
          patient={patient}
          saved={saved}
          onSave={() => {
            savePrescription({
              patientId: finalized.patientId,
              patientName: finalized.patientName,
              items: finalized.items,
              followUpDate: finalized.followUpDate,
              handwrittenNotes: finalized.handwrittenNotes ?? [],
            });
            setSaved(true);
            toast.success("Prescription saved to history");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepIndicator current={step} onStepClick={(i) => setStep(i)} />

      {patient && step > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <PatientCard patient={patient} />
          </div>
          <Button
            variant="ghost"
            className="h-12 shrink-0 rounded-xl font-bold"
            onClick={() => setStep(0)}
          >
            Change
          </Button>
        </div>
      )}

      {step === 0 && (
        <PatientStep
          onSelect={(p) => {
            setPatient(p);
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <MedicineStep
          onSelect={(m, s) => {
            setDraft({ medicine: m, strength: s });
            setEditing(undefined);
            setStep(2);
          }}
          onAttachNote={(url) => {
            setNotes((prev) => [...prev, url]);
            toast.success("Handwritten note attached");
          }}
          noteCount={notes.length}
        />
      )}

      {step === 2 && draft && (
        <DosageStep
          medicine={draft.medicine}
          initialStrength={draft.strength}
          existing={editing}
          onAdd={addItem}
          onCancel={() => {
            setDraft(null);
            setEditing(undefined);
            setStep(items.length ? 3 : 1);
          }}
        />
      )}

      {step === 3 && patient && (
        <ReviewStep
          patient={patient}
          items={items}
          notes={notes}
          onAddNote={(url) => {
            setNotes((prev) => [...prev, url]);
            toast.success("Handwritten note attached");
          }}
          onRemoveNote={(i) => setNotes((prev) => prev.filter((_, idx) => idx !== i))}
          followUp={followUp}
          onFollowUpChange={setFollowUp}
          onEdit={editItem}
          onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
          onAddAnother={() => setStep(1)}
          onFinalize={() =>
            setFinalized({
              id: `RX-${20500 + Math.floor(Math.random() * 500)}`,
              patientId: patient.id,
              patientName: patient.name,
              createdAt: new Date().toISOString(),
              items,
              followUpDate: followUp || null,
              handwrittenNotes: notes,
            })
          }
        />
      )}
    </div>
  );
}
