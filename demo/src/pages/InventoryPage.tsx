import { useState } from 'react';
import { INVENTORY } from '../data';
import type { InventoryItem } from '../types';
import StatusPill from '../components/StatusPill';

const CATEGORIES = ['All', ...Array.from(new Set(INVENTORY.map(i => i.category)))];

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [restocking, setRestocking] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockRef, setRestockRef] = useState('');
  const [stocks, setStocks] = useState<Record<string, number>>({});

  const filtered = INVENTORY.filter(item =>
    (category === 'All' || item.category === category) &&
    (!search || item.drug.toLowerCase().includes(search.toLowerCase()))
  );

  const getStock = (item: InventoryItem) => stocks[item.id] ?? item.currentStock;
  const getStatus = (item: InventoryItem): InventoryItem['status'] => {
    const s = getStock(item);
    if (s <= item.reorderLevel * 0.2) return 'critical';
    if (s <= item.reorderLevel) return 'low';
    return 'ok';
  };

  const handleRestock = () => {
    if (!restocking || !restockQty) return;
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty <= 0) return;
    setStocks(prev => ({ ...prev, [restocking.id]: getStock(restocking) + qty }));
    setRestocking(null);
    setRestockQty('');
    setRestockRef('');
  };

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
          Inventory
        </h1>
        <input
          type="search"
          placeholder="Search drugs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid #D9E8EF',
            borderRadius: 6,
            fontSize: 13,
            color: '#0F172A',
            outline: 'none',
            fontFamily: 'inherit',
            width: 220,
          }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 12px',
                border: '1px solid',
                borderColor: category === cat ? '#0AADA8' : '#D9E8EF',
                borderRadius: 5,
                background: category === cat ? '#D4F0EF' : '#fff',
                color: category === cat ? '#0AADA8' : '#64748B',
                fontSize: 12,
                fontWeight: category === cat ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.1s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 80px 100px 80px 80px 100px',
          padding: '10px 20px',
          borderBottom: '1px solid #D9E8EF',
          background: '#F0F9FB',
        }}>
          {['Drug', 'Category', 'Unit', 'In Stock', 'Reorder', 'Status', ''].map((h, i) => (
            <span key={i} style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              textAlign: i >= 3 && i <= 5 ? 'right' : i === 6 ? 'right' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        {filtered.map((item, i) => (
          <div key={item.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 80px 100px 80px 80px 100px',
            padding: '12px 20px',
            borderBottom: i < filtered.length - 1 ? '1px solid #D9E8EF' : 'none',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{item.drug}</span>
            <span style={{ fontSize: 13, color: '#64748B' }}>{item.category}</span>
            <span style={{ fontSize: 13, color: '#64748B' }}>{item.unit}</span>
            <span style={{
              fontSize: 14,
              fontFamily: 'IBM Plex Mono, monospace',
              color: getStatus(item) === 'critical' ? '#DC2626' : getStatus(item) === 'low' ? '#D97706' : '#0F172A',
              textAlign: 'right',
              fontWeight: 500,
            }}>
              {getStock(item)}
            </span>
            <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B', textAlign: 'right' }}>
              {item.reorderLevel}
            </span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <StatusPill status={getStatus(item)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRestocking(item)}
                style={{
                  padding: '5px 12px',
                  border: '1px solid #D9E8EF',
                  borderRadius: 5,
                  background: '#fff',
                  color: '#0F172A',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.1s',
                }}
              >
                Restock
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Restock modal */}
      {restocking && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(27,34,44,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid #D9E8EF',
            borderRadius: 10,
            padding: 28,
            width: 380,
            boxShadow: '0 8px 32px rgba(27,34,44,0.12)',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Restock</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>{restocking.drug}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={mLabel}>Quantity ({restocking.unit}s)</label>
                <input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={e => setRestockQty(e.target.value)}
                  placeholder="e.g. 200"
                  style={mInput}
                />
              </div>
              <div>
                <label style={mLabel}>Delivery Reference</label>
                <input
                  type="text"
                  value={restockRef}
                  onChange={e => setRestockRef(e.target.value)}
                  placeholder="e.g. PO-2026-0481"
                  style={mInput}
                />
              </div>
              <div>
                <label style={mLabel}>Timestamp</label>
                <input
                  type="text"
                  value={now}
                  readOnly
                  style={{ ...mInput, fontFamily: 'IBM Plex Mono, monospace', background: '#F0F9FB', color: '#64748B' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRestocking(null)}
                style={{ padding: '8px 16px', border: '1px solid #D9E8EF', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#0F172A' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#0AADA8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const mLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5,
};
const mInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #D9E8EF',
  borderRadius: 6,
  fontSize: 13,
  color: '#0F172A',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
