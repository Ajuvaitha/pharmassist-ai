import React, { useState } from 'react';
import { Code2, Terminal, Copy, Check, Play, FileText, Send, Sparkles, Server } from 'lucide-react';

const ENDPOINTS = [
  {
    id: 'create_rx',
    method: 'POST',
    path: '/inpatient/prescriptions',
    title: 'Create Inpatient Digital Prescription',
    desc: 'Registers doctor prescription and auto-schedules 24-hr daily execution batches.',
    requestHeader: 'Content-Type: application/json\nAuthorization: Bearer eyJhbGciOiJIUzI1Ni...',
    requestBody: JSON.stringify({
      patient_id: "PAT-9082",
      drug_id: "DRUG-1004",
      daily_dosage_qty: 3,
      frequency_code: "TID",
      frequency_description: "Every 8 hours",
      start_date: "2026-08-04",
      total_prescribed_days: 7,
      prescribing_doctor_id: "DOC-402",
      notes: "Administer post-meals"
    }, null, 2),
    responseCode: '201 Created',
    responseBody: JSON.stringify({
      success: true,
      message: "Inpatient prescription created successfully & 7 daily batches scheduled.",
      data: {
        rx_id: "RX-88410",
        patient_id: "PAT-9082",
        patient_name: "Sarah Jenkins",
        bed_number: "Bed 205",
        ward_name: "ICU Ward B",
        drug_name: "Paracetamol 650mg Tablet",
        daily_dosage_qty: 3,
        total_prescribed_days: 7,
        status: "ACTIVE"
      }
    }, null, 2),
    curl: `curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/prescriptions" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d '{"patient_id":"PAT-9082","drug_id":"DRUG-1004","daily_dosage_qty":3,"frequency_code":"TID","start_date":"2026-08-04","total_prescribed_days":7,"prescribing_doctor_id":"DOC-402"}'`
  },
  {
    id: 'get_pickups',
    method: 'GET',
    path: '/inpatient/wards/WARD-ICU-B/pickup-list',
    title: 'Get Ward Consolidated Pickup List',
    desc: 'Aggregates daily unit-dose requirements for all beds in a ward at 6:00 AM.',
    requestHeader: 'Authorization: Bearer eyJhbGciOiJIUzI1Ni...',
    requestBody: '// No request body required for GET request',
    responseCode: '200 OK',
    responseBody: JSON.stringify({
      success: true,
      indent_batch_id: "IND-20260804-ICUB",
      ward_id: "WARD-ICU-B",
      ward_name: "ICU Ward B",
      status: "READY_FOR_PICKUP",
      consolidated_items: [
        {
          drug_id: "DRUG-1004",
          drug_name: "Paracetamol 650mg Tablet",
          total_qty_needed: 3,
          unit_of_measure: "Tablets",
          patient_breakdown: [
            { patient_id: "PAT-9082", patient_name: "Sarah Jenkins", bed_number: "Bed 205", treatment_day: "Day 1 of 7", qty: 3 }
          ]
        }
      ]
    }, null, 2),
    curl: `curl -X GET "https://api.pharmassist.hospital.com/api/v1/inpatient/wards/WARD-ICU-B/pickup-list" \\\n  -H "Authorization: Bearer YOUR_TOKEN"`
  },
  {
    id: 'fulfill_indent',
    method: 'POST',
    path: '/inpatient/indents/fulfill',
    title: 'Confirm Pharmacy Dispense & Auto-Billing',
    desc: 'Confirms dispatch of unit-dose batch. Auto-deducts stock and posts daily charges to patient accounts.',
    requestHeader: 'Content-Type: application/json\nAuthorization: Bearer eyJhbGciOiJIUzI1Ni...',
    requestBody: JSON.stringify({
      indent_batch_id: "IND-20260804-ICUB",
      ward_id: "WARD-ICU-B",
      dispensed_by_pharmacist_id: "PHARM-108",
      picked_up_by_staff_id: "NURSE-512",
      dispense_notes: "Verified & sealed in Ward-B transport box."
    }, null, 2),
    responseCode: '200 OK',
    responseBody: JSON.stringify({
      success: true,
      message: "Indent batch fulfilled. Inventory updated & daily patient billing ledger updated.",
      data: {
        indent_batch_id: "IND-20260804-ICUB",
        status: "DISPENSED",
        billing_transactions: [
          { transaction_id: "TXN-9001", patient_name: "Sarah Jenkins", amount_billed: 45.00, status: "POSTED_TO_IPD_BILL" }
        ]
      }
    }, null, 2),
    curl: `curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/indents/fulfill" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d '{"indent_batch_id":"IND-20260804-ICUB","ward_id":"WARD-ICU-B","dispensed_by_pharmacist_id":"PHARM-108","picked_up_by_staff_id":"NURSE-512"}'`
  },
  {
    id: 'stop_order',
    method: 'POST',
    path: '/inpatient/prescriptions/RX-88410/stop',
    title: 'Real-Time Stop-Order (Cancel Pending Days)',
    desc: 'Immediately cancels active Rx on patient discharge or order change, stopping future pharmacy issuance.',
    requestHeader: 'Content-Type: application/json\nAuthorization: Bearer eyJhbGciOiJIUzI1Ni...',
    requestBody: JSON.stringify({
      reason: "DISCHARGE_EARLY",
      cancelled_by_doctor_id: "DOC-402",
      cancellation_notes: "Patient condition improved, discharged to home care."
    }, null, 2),
    responseCode: '200 OK',
    responseBody: JSON.stringify({
      success: true,
      message: "Prescription cancelled. Pending daily batches automatically updated to CANCELLED.",
      data: {
        rx_id: "RX-88410",
        patient_id: "PAT-9082",
        status: "CANCELLED",
        cancelled_future_days: [3, 4, 5, 6, 7],
        unissued_units_saved: 15
      }
    }, null, 2),
    curl: `curl -X POST "https://api.pharmassist.hospital.com/api/v1/inpatient/prescriptions/RX-88410/stop" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d '{"reason":"DISCHARGE_EARLY","cancelled_by_doctor_id":"DOC-402"}'`
  }
];

export default function ApiDocumentation() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [copiedId, setCopiedId] = useState('');
  const [testResult, setTestResult] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 3000);
  };

  const handleRunTest = () => {
    setTestResult('EXECUTING');
    setTimeout(() => {
      setTestResult({
        status: selectedEndpoint.responseCode,
        body: selectedEndpoint.responseBody,
        time: '42ms'
      });
    }, 600);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span className="glow-pill-cyan"><Terminal size={14} /> Built-in API Playground</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Base URL: https://api.pharmassist.hospital.com/api/v1</span>
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Interactive REST API Specifications & Playground</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Explore detailed endpoint schemas, test live requests, copy cURL commands, and inspect full JSON response bodies.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        
        {/* Endpoint Selector List */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px', paddingLeft: '8px' }}>
            Available API Endpoints
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ENDPOINTS.map((ep) => {
              const isSelected = selectedEndpoint.id === ep.id;
              const isPost = ep.method === 'POST';

              return (
                <button
                  key={ep.id}
                  onClick={() => { setSelectedEndpoint(ep); setTestResult(null); }}
                  style={{
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: isSelected ? '1px solid var(--border-glow)' : '1px solid var(--border-subtle)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        background: isPost ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: isPost ? '#34d399' : '#38bdf8'
                      }}
                    >
                      {ep.method}
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: isSelected ? '#fff' : 'var(--text-muted)' }}>
                      {ep.title}
                    </span>
                  </div>
                  <div className="code-font" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ep.path}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Endpoint Playground & Viewer */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          
          {/* Endpoint Details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    background: selectedEndpoint.method === 'POST' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                    color: selectedEndpoint.method === 'POST' ? '#34d399' : '#38bdf8'
                  }}
                >
                  {selectedEndpoint.method}
                </span>
                <span className="code-font" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                  {selectedEndpoint.path}
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                {selectedEndpoint.desc}
              </p>
            </div>

            <button className="btn-primary" onClick={handleRunTest}>
              <Play size={16} /> Execute Mock Request
            </button>
          </div>

          {/* Request Header & Body */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Request Headers & Body</span>
              <button
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleCopy(selectedEndpoint.requestBody, 'reqBody')}
              >
                {copiedId === 'reqBody' ? <Check size={14} /> : <Copy size={14} />} Copy JSON
              </button>
            </div>
            <pre className="code-font" style={{ background: '#090d16', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', color: '#34d399', fontSize: '0.82rem', overflowX: 'auto' }}>
              {selectedEndpoint.requestBody}
            </pre>
          </div>

          {/* Response Inspector */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Expected Response ({selectedEndpoint.responseCode})</span>
              <button
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleCopy(selectedEndpoint.responseBody, 'resBody')}
              >
                {copiedId === 'resBody' ? <Check size={14} /> : <Copy size={14} />} Copy Response
              </button>
            </div>
            <pre className="code-font" style={{ background: '#090d16', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', color: '#38bdf8', fontSize: '0.82rem', overflowX: 'auto' }}>
              {selectedEndpoint.responseBody}
            </pre>
          </div>

          {/* cURL Snippet */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>cURL Command</span>
              <button
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleCopy(selectedEndpoint.curl, 'curl')}
              >
                {copiedId === 'curl' ? <Check size={14} /> : <Copy size={14} />} Copy cURL
              </button>
            </div>
            <pre className="code-font" style={{ background: '#090d16', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', color: '#a78bfa', fontSize: '0.78rem', overflowX: 'auto' }}>
              {selectedEndpoint.curl}
            </pre>
          </div>

          {/* Test Execution Output Modal/Panel */}
          {testResult && (
            <div style={{ marginTop: '20px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', padding: '16px' }}>
              {testResult === 'EXECUTING' ? (
                <div style={{ color: '#38bdf8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} /> Sending request to server mock...
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="glow-pill-emerald" style={{ fontSize: '0.8rem' }}>
                      Status: {testResult.status} &bull; Latency: {testResult.time}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Response Received</span>
                  </div>
                  <pre className="code-font" style={{ background: '#090d16', padding: '10px', borderRadius: '8px', color: '#34d399', fontSize: '0.78rem', overflowX: 'auto' }}>
                    {testResult.body}
                  </pre>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
