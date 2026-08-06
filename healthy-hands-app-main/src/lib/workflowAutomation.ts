/**
 * workflowAutomation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated Patient Schedule Workflow Integration
 *
 * Webhook Endpoint: https://api.agents.snsihub.ai/webhook-test/generate-schedule
 *
 * Sends prescription details (patient, medicines, follow-up date, dosage)
 * to automatically trigger AI patient scheduling & medication reminder workflows.
 */

export const WORKHOOK_URL = "https://api.agents.snsihub.ai/webhook-test/generate-schedule";

export interface WorkflowPayload {
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  clinicName: string;
  doctorName: string;
  createdAt: string;
  followUpDate: string | null;
  items: Array<{
    medicineName: string;
    brand: string;
    strength: string;
    form: string;
    quantity: number;
    frequency: string;
    timing: string;
    durationDays: number;
    instructions: string[];
  }>;
}

export interface WorkflowResponse {
  success: boolean;
  message: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Triggers the automated patient schedule workflow webhook.
 */
export async function triggerPatientScheduleWorkflow(
  payload: WorkflowPayload
): Promise<WorkflowResponse> {
  const now = new Date().toISOString();
  try {
    const response = await fetch(WORKHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        event: "PRESCRIPTION_FINALIZED",
        timestamp: now,
        prescription: payload,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText} ${text ? `- ${text}` : ""}`,
        timestamp: now,
      };
    }

    const data = await response.json().catch(() => null);
    return {
      success: true,
      message: "Automated patient schedule workflow successfully triggered",
      timestamp: now,
      data,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Workflow trigger failed: ${errMsg}`,
      timestamp: now,
    };
  }
}
