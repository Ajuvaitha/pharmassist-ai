import { Printer, MessageCircle, Mail, Smartphone, Save, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp, type Prescription } from "@/lib/store";
import type { Patient } from "@/data/patients";

export function PrescriptionPreview({
  prescription,
  patient,
  onSave,
  saved,
}: {
  prescription: Omit<Prescription, "id"> & { id?: string };
  patient: Patient;
  onSave?: () => void;
  saved?: boolean;
}) {
  const { doctor } = useApp();
  const date = new Date(prescription.createdAt);

  return (
    <div className="space-y-5">
      <article className="print-sheet card-soft overflow-hidden">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border bg-primary/5 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Stethoscope className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight">{doctor.clinic}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {doctor.name} · {doctor.specialty}
              </p>
              <p className="truncate text-xs text-muted-foreground">Reg. No. {doctor.regNo}</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-bold text-foreground">{prescription.id ?? "Draft"}</p>
            <p>{date.toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
          </div>
        </header>

        <section className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Patient" value={`${patient.name} (${patient.id})`} />
          <Field label="Age / Gender" value={`${patient.age} yrs · ${patient.gender}`} />
          <Field label="Phone" value={patient.phone} />
          <Field label="Allergies" value={patient.allergies || "None known"} />
        </section>

        <section className="p-5 sm:p-6">
          <p className="mb-3 text-2xl font-extrabold text-primary">℞</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-bold">Medicine</th>
                  <th className="py-2 pr-3 font-bold">Dosage</th>
                  <th className="py-2 pr-3 font-bold">Frequency</th>
                  <th className="py-2 pr-3 font-bold">Duration</th>
                  <th className="py-2 font-bold">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {prescription.items.map((it, i) => (
                  <tr key={it.id} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-3">
                      <span className="font-bold">
                        {i + 1}. {it.medicineName} {it.strength}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {it.brand} · {it.form}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {it.quantity} {it.form.toLowerCase()}
                      {it.quantity > 1 ? "s" : ""}
                    </td>
                    <td className="py-3 pr-3">
                      {it.frequency}
                      <span className="block text-xs text-muted-foreground">
                        {it.frequencyShort} · {it.timing}
                      </span>
                    </td>
                    <td className="py-3 pr-3">{it.durationDays} days</td>
                    <td className="py-3 text-muted-foreground">
                      {it.instructions.length ? it.instructions.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(prescription.handwrittenNotes?.length ?? 0) > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Doctor's handwritten notes
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {prescription.handwrittenNotes?.map((n, i) => (
                  <img
                    key={i}
                    src={n}
                    alt={`Doctor's handwritten note ${i + 1}`}
                    className="block w-full rounded-xl border border-border"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
            <p className="text-sm">
              <span className="font-bold">Follow-up: </span>
              {prescription.followUpDate
                ? new Date(prescription.followUpDate).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })
                : "As needed"}
            </p>
            <div className="text-center">
              <p className="mb-1 font-[cursive] text-lg italic text-primary">{doctor.name}</p>
              <div className="w-44 border-t border-border pt-1 text-xs text-muted-foreground">
                Doctor's signature
              </div>
            </div>
          </div>
        </section>
      </article>

      <div className="no-print grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          onClick={() => window.print()}
          size="lg"
          className="h-14 rounded-2xl text-base font-bold"
        >
          <Printer className="mr-2 h-5 w-5" /> Print
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl text-base font-bold"
          onClick={() => toast.success("Shared via WhatsApp (demo)")}
        >
          <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl text-base font-bold"
          onClick={() => toast.success("Emailed to patient (demo)")}
        >
          <Mail className="mr-2 h-5 w-5" /> Email
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl text-base font-bold"
          onClick={() => toast.success("Sent via SMS (demo)")}
        >
          <Smartphone className="mr-2 h-5 w-5" /> SMS
        </Button>
        {onSave && (
          <Button
            onClick={onSave}
            disabled={saved}
            size="lg"
            className="h-14 rounded-2xl text-base font-bold sm:col-span-2 lg:col-span-4"
            variant="secondary"
          >
            <Save className="mr-2 h-5 w-5" /> {saved ? "Saved to history" : "Save to history"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
