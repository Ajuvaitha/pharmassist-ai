import React from 'react';
import { Receipt, Package, DollarSign, CheckCircle2, TrendingUp, ShieldCheck, Database } from 'lucide-react';

export default function PharmacyBillingLedger({ drugs, transactions }) {
  const totalBilledAmount = transactions.reduce((sum, tx) => sum + (tx.amount_billed || 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="glow-pill-emerald"><Receipt size={14} /> Auto-Ledger System</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Zero Upfront 7-Day Billing Chaos</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Central Pharmacy Stock & Daily Billing Ledger</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Stock is automatically deducted and daily line-item charges are posted to patient IPD accounts strictly upon pharmacy unit-dose issue confirmation.
            </p>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 20px', borderRadius: '14px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Today's Auto-Billed Total</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
              ₹{totalBilledAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Central Stock Levels & Ledger Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Drug Inventory Monitor */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
            <Package size={20} /> Central Pharmacy Inventory Stock
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {drugs.map((drug) => {
              const stockRatio = Math.min(100, Math.round((drug.stock / 5000) * 100));
              return (
                <div key={drug.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{drug.name}</span>
                    <span className="glow-pill-cyan" style={{ fontSize: '0.78rem' }}>
                      {drug.stock} {drug.unitOfMeasure}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                    <span>Category: {drug.category}</span>
                    <span>Price: ₹{drug.unitPrice} / {drug.unitOfMeasure}</span>
                  </div>

                  <div style={{ width: '100%', height: '6px', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${stockRatio}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #0284c7 0%, #34d399 100%)',
                        borderRadius: '3px'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily IPD Billing Ledger Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
            <Receipt size={20} /> Real-Time IPD Daily Billing Ledger
          </h3>

          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No transactions posted today yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Txn ID</th>
                    <th style={{ padding: '8px' }}>Patient / Bed</th>
                    <th style={{ padding: '8px' }}>Medication</th>
                    <th style={{ padding: '8px' }}>Qty</th>
                    <th style={{ padding: '8px' }}>Billed Amount</th>
                    <th style={{ padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.transaction_id} style={{ background: 'rgba(15, 23, 42, 0.6)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>
                        {tx.transaction_id}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 500 }}>
                        {tx.patient_name}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{tx.bed_number}</div>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                        {tx.drug_name}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#34d399', fontWeight: 600 }}>
                        {tx.qty}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#34d399' }}>
                        ₹{tx.amount_billed?.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className="glow-pill-emerald" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                          <CheckCircle2 size={12} /> POSTED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
