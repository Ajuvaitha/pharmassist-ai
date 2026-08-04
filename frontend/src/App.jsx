import React, { useState } from 'react';
import Header from './components/Header';
import WardIndentSweep from './components/WardIndentSweep';
import PrescriptionEntry from './components/PrescriptionEntry';
import PatientBedMonitor from './components/PatientBedMonitor';
import PharmacyBillingLedger from './components/PharmacyBillingLedger';
import ApiDocumentation from './components/ApiDocumentation';

import {
  INITIAL_WARDS,
  INITIAL_DRUGS,
  INITIAL_PATIENTS,
  INITIAL_PRESCRIPTIONS,
  INITIAL_CONSOLIDATED_PICKUPS,
  INITIAL_BILLING_TRANSACTIONS
} from './mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('sweep');
  const [wards, setWards] = useState(INITIAL_WARDS);
  const [drugs, setDrugs] = useState(INITIAL_DRUGS);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [prescriptions, setPrescriptions] = useState(INITIAL_PRESCRIPTIONS);
  const [consolidatedPickups, setConsolidatedPickups] = useState(INITIAL_CONSOLIDATED_PICKUPS);
  const [billingTransactions, setBillingTransactions] = useState(INITIAL_BILLING_TRANSACTIONS);

  // Active counts
  const activePrescriptionsCount = prescriptions.filter(p => p.status === 'ACTIVE').length;
  const readyPickupsCount = Object.values(consolidatedPickups).filter(p => p.status === 'READY_FOR_PICKUP').length;

  // Handler: Confirm Pharmacy Dispense & Auto-Billing
  const handleFulfillBatch = (wardId, fulfillmentDetails) => {
    const currentPickup = consolidatedPickups[wardId];
    if (!currentPickup) return;

    // 1. Mark pickup status as DISPENSED
    setConsolidatedPickups(prev => ({
      ...prev,
      [wardId]: {
        ...prev[wardId],
        status: 'DISPENSED'
      }
    }));

    // 2. Generate daily billing transactions & deduct stock
    const newTxns = [];
    const stockDeductions = {};

    currentPickup.items.forEach(item => {
      stockDeductions[item.drug_id] = (stockDeductions[item.drug_id] || 0) + item.total_qty_needed;
      
      const targetDrug = drugs.find(d => d.id === item.drug_id);
      const unitPrice = targetDrug ? targetDrug.unitPrice : 20.00;

      item.patient_breakdown.forEach(p => {
        newTxns.push({
          transaction_id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
          indent_batch_id: currentPickup.indent_batch_id,
          patient_id: p.patient_id,
          patient_name: p.patient_name,
          bed_number: p.bed_number,
          ward_name: currentPickup.ward_name,
          drug_name: item.drug_name,
          qty: p.qty,
          unit_price: unitPrice,
          amount_billed: p.qty * unitPrice,
          timestamp: new Date().toISOString(),
          status: 'POSTED_TO_IPD_BILL'
        });
      });
    });

    // Update transactions ledger
    setBillingTransactions(prev => [...newTxns, ...prev]);

    // Update central inventory stock
    setDrugs(prev => prev.map(drug => {
      if (stockDeductions[drug.id]) {
        return {
          ...drug,
          stock: Math.max(0, drug.stock - stockDeductions[drug.id])
        };
      }
      return drug;
    }));
  };

  // Handler: Manual 6:00 AM Indent Sweep recalculation
  const handleTriggerSweep = (wardId) => {
    // Recalculates active prescriptions for the ward
    const wardRxs = prescriptions.filter(p => p.ward_id === wardId && p.status === 'ACTIVE');
    
    // Group by drug
    const drugMap = {};
    wardRxs.forEach(rx => {
      if (!drugMap[rx.drug_id]) {
        drugMap[rx.drug_id] = {
          drug_id: rx.drug_id,
          drug_name: rx.drug_name,
          total_qty_needed: 0,
          unit: rx.drug_name.includes('Injection') || rx.drug_name.includes('IV') ? 'Vials' : 'Tablets',
          patient_breakdown: []
        };
      }
      drugMap[rx.drug_id].total_qty_needed += rx.daily_dosage_qty;
      drugMap[rx.drug_id].patient_breakdown.push({
        patient_id: rx.patient_id,
        patient_name: rx.patient_name,
        bed_number: rx.bed_number,
        treatment_day: `Day ${rx.current_day} of ${rx.total_prescribed_days}`,
        qty: rx.daily_dosage_qty
      });
    });

    const targetWard = wards.find(w => w.id === wardId);

    setConsolidatedPickups(prev => ({
      ...prev,
      [wardId]: {
        indent_batch_id: `IND-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${wardId.split('-').pop()}`,
        date: new Date().toISOString().split('T')[0],
        ward_id: wardId,
        ward_name: targetWard ? targetWard.name : wardId,
        status: 'READY_FOR_PICKUP',
        items: Object.values(drugMap)
      }
    }));
  };

  // Handler: Add New Prescription
  const handleAddPrescription = (newRx) => {
    setPrescriptions(prev => [newRx, ...prev]);
    // Trigger sweep for that ward to update pick list dynamically
    handleTriggerSweep(newRx.ward_id);
  };

  // Handler: Real-Time Stop-Order Cancellation
  const handleStopOrder = (rxId, details) => {
    setPrescriptions(prev => prev.map(rx => {
      if (rx.rx_id === rxId) {
        return {
          ...rx,
          status: 'CANCELLED',
          cancellation_reason: details.reason,
          cancellation_notes: details.notes
        };
      }
      return rx;
    }));

    // Update pickups manifest to reflect cancelled patient order
    const targetRx = prescriptions.find(p => p.rx_id === rxId);
    if (targetRx) {
      setTimeout(() => handleTriggerSweep(targetRx.ward_id), 100);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 20px' }}>
        
        {/* Navigation & Status Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activePrescriptionsCount={activePrescriptionsCount}
          readyPickupsCount={readyPickupsCount}
        />

        {/* Tab Views */}
        <main>
          {activeTab === 'sweep' && (
            <WardIndentSweep
              wards={wards}
              consolidatedPickups={consolidatedPickups}
              onFulfillBatch={handleFulfillBatch}
              onTriggerSweep={handleTriggerSweep}
            />
          )}

          {activeTab === 'prescribe' && (
            <PrescriptionEntry
              patients={patients}
              drugs={drugs}
              onAddPrescription={handleAddPrescription}
            />
          )}

          {activeTab === 'patients' && (
            <PatientBedMonitor
              prescriptions={prescriptions}
              onStopOrder={handleStopOrder}
            />
          )}

          {activeTab === 'billing' && (
            <PharmacyBillingLedger
              drugs={drugs}
              transactions={billingTransactions}
            />
          )}

          {activeTab === 'apidocs' && (
            <ApiDocumentation />
          )}
        </main>

      </div>
    </div>
  );
}
