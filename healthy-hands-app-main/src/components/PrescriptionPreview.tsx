import { useState } from "react";
import { Printer, MessageCircle, Mail, Smartphone, Save, Stethoscope, Zap, Sparkles, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp, type Prescription } from "@/lib/store";
import type { Patient } from "@/data/patients";
import { cn } from "@/lib/utils";
import { triggerPatientScheduleWorkflow, WORKHOOK_URL, type WorkflowPayload } from "@/lib/workflowAutomation";

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

      {/* Workflow Automation Card */}
      <WorkflowAutomationCard
        prescription={prescription}
        patient={patient}
        clinicName={doctor.clinic}
        doctorName={doctor.name}
      />

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

function WorkflowAutomationCard({
  prescription,
  patient,
  clinicName,
  doctorName,
}: {
  prescription: Omit<Prescription, "id"> & { id?: string };
  patient: Patient;
  clinicName: string;
  doctorName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [logMessage, setLogMessage] = useState("");

  async function handleTrigger() {
    setLoading(true);
    setStatus("idle");
    setLogMessage("Sending payload to webhook...");

    const payload: WorkflowPayload = {
      prescriptionId: prescription.id ?? `RX-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientAge: patient.age,
      patientGender: patient.gender,
      clinicName,
      doctorName,
      createdAt: prescription.createdAt,
      followUpDate: prescription.followUpDate,
      items: prescription.items,
    };

    const res = await triggerPatientScheduleWorkflow(payload);
    setLoading(false);

    if (res.success) {
      setStatus("success");
      setLogMessage(res.message);
      toast.success("Automated Patient Schedule Workflow Triggered! ⚡");
    } else {
      setStatus("error");
      setLogMessage(res.message);
      toast.error("Webhook trigger notice: Check connection or CORS endpoint");
    }
  }

  return (
    <div className="no-print card-soft p-5 space-y-4 border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-card to-accent/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
            Automated Patient Schedule Workflow
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Webhook URL: <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-[11px] text-foreground">{WORKHOOK_URL}</code>
          </p>
        </div>
        <Button
          onClick={handleTrigger}
          disabled={loading}
          className="h-12 rounded-xl text-sm font-bold gap-2 bg-primary"
        >
          {loading ? (
            <>
              <Sparkles className="h-4 w-4 animate-spin" /> Triggering Workflow...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" /> Trigger Automation Schedule
            </>
          )}
        </Button>
      </div>

      {status !== "idle" && (
        <div
          className={cn(
            "rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 transition-all",
            status === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
          )}
        >
          {status === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <ExternalLink className="h-4 w-4 shrink-0 text-amber-600" />
          )}
          <span className="flex-1 truncate">{logMessage}</span>
        </div>
      )}
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
