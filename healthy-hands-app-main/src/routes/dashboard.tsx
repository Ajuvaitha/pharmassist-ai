import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Clock, ChevronRight, CalendarDays, Users, FileText, Zap, Sparkles, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useApp, type Prescription, type Doctor } from "@/lib/store";
import type { Patient } from "@/data/patients";
import { cn } from "@/lib/utils";
import { triggerPatientScheduleWorkflow, WORKHOOK_URL, type WorkflowPayload } from "@/lib/workflowAutomation";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Today's Clinic — Smart e-Prescription" },
      {
        name: "description",
        content: "Today's appointments, recent prescriptions and one-tap new prescription.",
      },
      { property: "og:title", content: "Today's Clinic — Smart e-Prescription" },
      {
        property: "og:description",
        content: "Today's appointments, recent prescriptions and one-tap new prescription.",
      },
    ],
  }),
  component: () => (
      <AppShell>
        <Dashboard />
      </AppShell>
  ),
});

function Dashboard() {
  const { doctor, appointments, patients, prescriptions } = useApp();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <section className="card-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" /> {today}
          </p>
          <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            Good morning, {doctor.name.replace("Dr. ", "Dr ")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {appointments.filter((a) => a.status !== "Done").length} patients still waiting today.
          </p>
        </div>
        <Button asChild size="lg" className="h-14 shrink-0 rounded-2xl px-5 text-base font-bold">
          <Link to="/prescribe" search={{ patient: undefined }}>
            <Plus className="mr-1 h-5 w-5" />
            <span className="hidden sm:inline">New Prescription</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Today's patients" value={appointments.length} />
        <Stat icon={FileText} label="Prescriptions issued" value={prescriptions.length} />
        <Stat icon={Users} label="Registered patients" value={patients.length} />
      </section>

      {/* ── Workflow Automation & Patient Schedule Section ── */}
      <DashboardWorkflowSection doctor={doctor} prescriptions={prescriptions} patients={patients} />

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-lg font-extrabold tracking-tight">Today's appointments</h2>
          {appointments.map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            return (
              <Link
                key={a.id}
                to="/prescribe"
                search={{ patient: a.patientId }}
                className="card-soft flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xs font-extrabold text-primary">
                  {a.time.replace(" AM", "").replace(" PM", "")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p?.name ?? a.patientId}</span>
                  <span className="block truncate text-sm text-muted-foreground">{a.reason}</span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold sm:block",
                    a.status === "Done" && "bg-success/20 text-success-foreground",
                    a.status === "Waiting" && "bg-warning/25 text-warning-foreground",
                    a.status === "In consult" && "bg-primary/15 text-primary",
                  )}
                >
                  {a.status}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate text-lg font-extrabold tracking-tight">Recent prescriptions</h2>
            <Link to="/history" className="shrink-0 text-sm font-bold text-primary">
              View all
            </Link>
          </div>
          {prescriptions.slice(0, 5).map((rx) => (
            <Link
              key={rx.id}
              to="/history"
              className="card-soft flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/25 text-accent-foreground">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{rx.patientName}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {rx.id} · {rx.items.length} medicine{rx.items.length > 1 ? "s" : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {new Date(rx.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="card-soft flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function DashboardWorkflowSection({
  doctor,
  prescriptions,
  patients,
}: {
  doctor: Doctor;
  prescriptions: Prescription[];
  patients: Patient[];
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [logMsg, setLogMsg] = useState("");

  const latestRx = prescriptions[0];
  const patient = latestRx ? patients.find((p) => p.id === latestRx.patientId) : patients[0];

  async function handleTriggerTest() {
    setLoading(true);
    setStatus("idle");
    setLogMsg("Sending schedule workflow request...");

    const payload: WorkflowPayload = {
      prescriptionId: latestRx?.id ?? "RX-SAMPLE-101",
      patientId: patient?.id ?? "PT-1001",
      patientName: patient?.name ?? "Sample Patient",
      patientPhone: patient?.phone ?? "+919900122334",
      patientAge: patient?.age ?? 28,
      patientGender: patient?.gender ?? "Female",
      clinicName: doctor.clinic,
      doctorName: doctor.name,
      createdAt: latestRx?.createdAt ?? new Date().toISOString(),
      followUpDate: latestRx?.followUpDate ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      items: latestRx?.items ?? [
        {
          medicineName: "Amoxicillin 500mg",
          brand: "Mox 500",
          strength: "500mg",
          form: "Capsule",
          quantity: 10,
          frequency: "Twice a day",
          timing: "After food",
          durationDays: 5,
          instructions: ["Take after meal"],
        },
      ],
    };

    const res = await triggerPatientScheduleWorkflow(payload);
    setLoading(false);

    if (res.success) {
      setStatus("success");
      setLogMsg(res.message);
      toast.success("Automated Patient Schedule Workflow Triggered! ⚡");
    } else {
      setStatus("error");
      setLogMsg(res.message);
      toast.error("Workflow webhook response recorded.");
    }
  }

  return (
    <section className="card-soft p-5 space-y-4 border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-card to-accent/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Zap className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-extrabold tracking-tight">
              Automated Patient Schedule & Workflow Integration
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Webhook Test Endpoint:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border">
              {WORKHOOK_URL}
            </code>
          </p>
        </div>

        <Button
          onClick={handleTriggerTest}
          disabled={loading}
          size="lg"
          className="h-13 rounded-xl font-extrabold gap-2 bg-primary shrink-0"
        >
          {loading ? (
            <>
              <Sparkles className="h-4 w-4 animate-spin" /> Triggering Workflow...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" /> Test Automation Schedule
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
          <span className="flex-1 truncate">{logMsg}</span>
        </div>
      )}
    </section>
  );
}
