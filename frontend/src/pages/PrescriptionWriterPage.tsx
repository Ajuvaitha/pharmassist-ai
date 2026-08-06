import { useState, useRef, useEffect } from 'react';
import type { Patient, FoodTiming, MedRoute, TimeOfDay } from '../types';

interface PrescriptionWriterPageProps {
  patients: Patient[];
  doctorName: string;
  onAddPrescription: (patientId: string, rx: {
    drug: string; dose: string; route: MedRoute; frequency: string;
    foodTiming: FoodTiming; timeOfDay: TimeOfDay[]; startDate: string;
    durationDays: number; prescribedBy: string; prescribedAt: string; notes?: string;
  }) => void;
}

interface ParsedRx {
  id: string;
  drug: string;
  dose: string;
  route: MedRoute;
  frequency: string;
  foodTiming: FoodTiming;
  timeOfDay: TimeOfDay[];
  durationDays: number;
  notes: string;
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function parseRxText(text: string): ParsedRx[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: ParsedRx[] = [];

  const freqMap: Record<string, string> = {
    'once daily': 'OD', 'od': 'OD', 'once a day': 'OD', 'one time': 'OD',
    'twice daily': 'BD', 'bd': 'BD', 'twice a day': 'BD', 'two times': 'BD',
    'three times': 'TDS', 'tds': 'TDS', 'thrice': 'TDS', 'three times daily': 'TDS',
    'four times': 'QDS', 'qds': 'QDS', 'four times daily': 'QDS',
  };

  const routeMap: Record<string, MedRoute> = {
    'oral': 'Oral', 'by mouth': 'Oral', 'tablet': 'Oral', 'capsule': 'Oral',
    'iv': 'IV', 'intravenous': 'IV', 'drip': 'IV',
    'im': 'IM', 'intramuscular': 'IM', 'injection': 'IM',
    'sc': 'SC', 'subcutaneous': 'SC',
    'topical': 'Topical', 'cream': 'Topical', 'ointment': 'Topical',
    'inhaled': 'Inhaled', 'inhaler': 'Inhaled', 'nebulizer': 'Inhaled',
  };

  const foodMap: Record<string, FoodTiming> = {
    'before food': 'before-food', 'before meal': 'before-food', 'before eating': 'before-food',
    'after food': 'after-food', 'after meal': 'after-food', 'after eating': 'after-food',
    'with food': 'with-food',
  };

  const todMap: Record<string, TimeOfDay> = {
    morning: 'morning', 'in the morning': 'morning',
    afternoon: 'afternoon', 'in the afternoon': 'afternoon',
    evening: 'evening', 'in the evening': 'evening',
    night: 'night', 'at night': 'night', 'bedtime': 'night',
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('//') || lower.startsWith('#')) continue;

    const doseMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)\b/i);
    const dose = doseMatch ? `${doseMatch[1]}${doseMatch[2].toLowerCase()}` : '—';

    const durMatch = lower.match(/for\s+(\d+)\s*(day|days|week|weeks)/);
    let durationDays = 7;
    if (durMatch) {
      durationDays = parseInt(durMatch[1]) * (durMatch[2].startsWith('week') ? 7 : 1);
    }

    let frequency = 'OD';
    for (const [key, val] of Object.entries(freqMap)) {
      if (lower.includes(key)) { frequency = val; break; }
    }

    let route: MedRoute = 'Oral';
    for (const [key, val] of Object.entries(routeMap)) {
      if (lower.includes(key)) { route = val; break; }
    }

    let foodTiming: FoodTiming = 'not-applicable';
    for (const [key, val] of Object.entries(foodMap)) {
      if (lower.includes(key)) { foodTiming = val; break; }
    }

    const timeOfDay: TimeOfDay[] = [];
    for (const [key, val] of Object.entries(todMap)) {
      if (lower.includes(key) && !timeOfDay.includes(val)) timeOfDay.push(val);
    }
    if (timeOfDay.length === 0) {
      if (frequency === 'BD') timeOfDay.push('morning', 'evening');
      else if (frequency === 'TDS') timeOfDay.push('morning', 'afternoon', 'evening');
      else if (frequency === 'QDS') timeOfDay.push('morning', 'afternoon', 'evening', 'night');
      else timeOfDay.push('morning');
    }

    const drugRaw = doseMatch ? line.slice(0, line.toLowerCase().indexOf(doseMatch[0].toLowerCase())).trim() : line.split(' ')[0];
    const drug = drugRaw.replace(/^[-•*]\s*/, '').trim() || line.split(' ').slice(0, 2).join(' ');
    if (drug.length < 2) continue;

    results.push({
      id: `parsed-${Date.now()}-${results.length}`,
      drug: drug.charAt(0).toUpperCase() + drug.slice(1),
      dose, route, frequency, foodTiming, timeOfDay, durationDays, notes: '',
    });
  }
  return results;
}

const ROUTE_OPTIONS: MedRoute[] = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled'];
const FREQ_OPTIONS = ['OD', 'BD', 'TDS', 'QDS', 'PRN', 'STAT'];
const FOOD_OPTIONS: { value: FoodTiming; label: string }[] = [
  { value: 'before-food', label: 'Before food' },
  { value: 'after-food', label: 'After food' },
  { value: 'with-food', label: 'With food' },
  { value: 'not-applicable', label: 'Not applicable' },
];
const TOD_OPTIONS: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

type Mode = null | 'whiteboard' | 'mic';

export default function PrescriptionWriterPage({ patients, doctorName, onAddPrescription }: PrescriptionWriterPageProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [mode, setMode] = useState<Mode>(null);
  const [boardText, setBoardText] = useState('');
  const [parsedRxs, setParsedRxs] = useState<ParsedRx[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [micSupported, setMicSupported] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [ripple, setRipple] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicSupported(false); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(interim);
      if (final) {
        setBoardText(prev => prev ? prev + '\n' + final.trim() : final.trim());
      }
    };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    recognitionRef.current = r;
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript('');
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      setRipple(true);
      setTimeout(() => setRipple(false), 600);
      textareaRef.current?.focus();
    }
  };

  const updateParsed = (id: string, field: keyof ParsedRx, value: unknown) => {
    setParsedRxs(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const toggleTod = (id: string, tod: TimeOfDay) => {
    setParsedRxs(prev => prev.map(r => {
      if (r.id !== id) return r;
      const has = r.timeOfDay.includes(tod);
      return { ...r, timeOfDay: has ? r.timeOfDay.filter(t => t !== tod) : [...r.timeOfDay, tod] };
    }));
  };

  const saveAll = () => {
    if (!selectedPatientId) return;
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    for (const rx of parsedRxs) {
      onAddPrescription(selectedPatientId, {
        drug: rx.drug, dose: rx.dose, route: rx.route,
        frequency: rx.frequency, foodTiming: rx.foodTiming,
        timeOfDay: rx.timeOfDay, startDate: new Date().toISOString().slice(0, 10),
        durationDays: rx.durationDays, prescribedBy: doctorName,
        prescribedAt: now, notes: rx.notes,
      });
    }
    setSavedCount(parsedRxs.length);
    setParsedRxs([]);
    setBoardText('');
    setTranscript('');
    setTimeout(() => setSavedCount(0), 3000);
  };

  const selectPatient = (id: string) => {
    setSelectedPatientId(id);
    setMode(null);
    setParsedRxs([]);
    setBoardText('');
    setTranscript('');
  };

  const changePatient = () => {
    setSelectedPatientId('');
    setMode(null);
    setParsedRxs([]);
    setBoardText('');
    setTranscript('');
    if (isListening) recognitionRef.current?.stop();
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
            Prescription Writer
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Dr. {doctorName} · Korle Bu Teaching Hospital
          </p>
        </div>
        {savedCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', background: '#DCFCE7', borderRadius: 8,
            border: '1px solid #A7F3D0', color: '#16A34A', fontSize: 13, fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#16A34A" strokeWidth="1.4"/>
              <path d="M5 8l2.5 2.5 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {savedCount} prescription{savedCount > 1 ? 's' : ''} saved
          </div>
        )}
      </div>

      {/* STEP 1: Patient selection */}
      {!selectedPatientId && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select a Patient to Prescribe For
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {patients.map(p => {
              const age = p.dateOfBirth ? calcAge(p.dateOfBirth) : null;
              const activeRx = p.prescriptions.filter(rx => rx.status === 'active').length;
              return (
                <button
                  key={p.id}
                  onClick={() => selectPatient(p.id)}
                  style={{
                    background: '#fff', border: '1px solid #D9E8EF', borderRadius: 10,
                    padding: '16px 20px', textAlign: 'left', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'box-shadow 0.12s, border-color 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,173,168,0.1)';
                    e.currentTarget.style.borderColor = '#0AADA8';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#D9E8EF';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                      <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B', marginTop: 2 }}>
                        {p.mrn}
                        {age !== null && <span style={{ marginLeft: 8, color: '#94A3B8' }}>· {age} yrs</span>}
                      </div>
                    </div>
                    {p.allergies && p.allergies !== 'None known' && (
                      <span style={{ fontSize: 10, background: '#FEE2E2', color: '#DC2626', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                        ALLERGY
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
                    <span>{p.ward} · Bed {p.bed}</span>
                    <span style={{ color: '#94A3B8' }}>|</span>
                    <span>{p.diagnosis}</span>
                  </div>
                  {activeRx > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <span style={{ background: '#DBEAFE', color: '#2563EB', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                        {activeRx} active Rx
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* STEP 2: Patient selected — show details + mode choice */}
      {selectedPatient && (
        <>
          {/* Patient details card */}
          <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: 3, background: '#0AADA8' }} />
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 20 }}>
                {/* Avatar */}
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: '#D4F0EF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#0AADA8', flexShrink: 0,
                }}>
                  {selectedPatient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B', marginTop: 2 }}>
                    {selectedPatient.mrn}
                    {selectedPatient.dateOfBirth && (
                      <span style={{ marginLeft: 8 }}>· {calcAge(selectedPatient.dateOfBirth)} yrs</span>
                    )}
                    <span style={{ marginLeft: 8 }}>· {selectedPatient.gender}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: selectedPatient.ward, bg: '#F0F9FB', color: '#0AADA8' },
                      { label: `Bed ${selectedPatient.bed}`, bg: '#F0F9FB', color: '#0AADA8' },
                      { label: selectedPatient.diagnosis, bg: '#FAFBFC', color: '#64748B' },
                    ].map(chip => (
                      <span key={chip.label} style={{
                        fontSize: 12, padding: '3px 9px', borderRadius: 4,
                        background: chip.bg, color: chip.color, fontWeight: 500,
                      }}>
                        {chip.label}
                      </span>
                    ))}
                    {selectedPatient.allergies && selectedPatient.allergies !== 'None known' && (
                      <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', fontWeight: 700 }}>
                        ⚠ {selectedPatient.allergies}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={changePatient}
                style={{
                  padding: '6px 14px', border: '1px solid #D9E8EF', borderRadius: 6,
                  background: '#fff', color: '#64748B', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                ← Change Patient
              </button>
            </div>
          </div>

          {/* STEP 2b: Mode selection */}
          {!mode && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
              {/* Whiteboard */}
              <button
                onClick={() => setMode('whiteboard')}
                style={{
                  background: '#fff', border: '2px solid #D9E8EF', borderRadius: 14,
                  padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#0AADA8';
                  e.currentTarget.style.background = '#F0FAFA';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(10,173,168,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#D9E8EF';
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', background: '#0AADA8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(10,173,168,0.3)',
                }}>
                  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <rect x="3" y="5" width="28" height="22" rx="2.5" stroke="#fff" strokeWidth="1.8"/>
                    <path d="M8 24l5-5 3 3 5-7 5 9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M26 9l2 2-8 8-2.5.5.5-2.5L26 9z" fill="#fff" fillOpacity="0.9"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                    Whiteboard
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                    Write prescriptions on the tablet pad.<br />
                    Parsed automatically into structured orders.
                  </div>
                </div>
              </button>

              {/* Mic */}
              <button
                onClick={() => setMode('mic')}
                style={{
                  background: '#fff', border: '2px solid #D9E8EF', borderRadius: 14,
                  padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#0F172A';
                  e.currentTarget.style.background = '#F8FBFC';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#D9E8EF';
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', background: '#0F172A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
                }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="11" y="4" width="10" height="16" rx="5" fill="#fff"/>
                    <path d="M6 16a10 10 0 0020 0" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M16 26v4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M11 30h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                    Voice Dictation
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                    Speak the drug names and dosages.<br />
                    Transcribed and parsed in real time.
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* STEP 3a: Whiteboard mode */}
          {mode === 'whiteboard' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setMode(null)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 13, color: '#64748B', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 2L4 7l5 5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Back to mode selection
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
                {/* Prescription pad */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{
                    background: '#fff', border: '1px solid #D9E8EF', borderRadius: 12, overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(10,173,168,0.06)',
                  }}>
                    <div style={{
                      padding: '14px 24px 12px', background: '#0AADA8',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', fontStyle: 'italic', lineHeight: 1 }}>℞</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Prescription Pad</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                            {selectedPatient.name} · {selectedPatient.mrn}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(255,255,255,0.8)' }}>
                        {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    <div style={{ position: 'relative', background: '#fff' }}>
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 35px, #E8F3F8 35px, #E8F3F8 36px)',
                        backgroundPositionY: '20px',
                      }} />
                      <div style={{
                        position: 'absolute', left: 56, top: 0, bottom: 0, width: 1,
                        background: 'rgba(220,38,38,0.15)', pointerEvents: 'none',
                      }} />
                      <textarea
                        ref={textareaRef}
                        value={boardText}
                        onChange={e => setBoardText(e.target.value)}
                        placeholder={"Write prescriptions here, one per line.\nExample:\nAmoxicillin 500mg three times daily for 7 days after food\nParacetamol 1g twice daily for 5 days\n"}
                        style={{
                          position: 'relative', width: '100%', minHeight: 300,
                          padding: '22px 24px 22px 68px',
                          border: 'none', outline: 'none', resize: 'vertical',
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontSize: 15, lineHeight: '36px',
                          color: '#0F172A', background: 'transparent',
                          boxSizing: 'border-box', letterSpacing: '0.01em',
                        }}
                      />
                    </div>

                    <div style={{
                      padding: '12px 24px', borderTop: '1px solid #D9E8EF', background: '#F8FBFC',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        {boardText.split('\n').filter(Boolean).length} line{boardText.split('\n').filter(Boolean).length !== 1 ? 's' : ''} written
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => { setBoardText(''); setParsedRxs([]); }}
                          style={{
                            padding: '6px 14px', border: 'none', borderRadius: 6,
                            background: 'transparent', color: '#94A3B8', fontSize: 12,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setParsedRxs(parseRxText(boardText))}
                          disabled={!boardText.trim()}
                          style={{
                            padding: '6px 18px', border: 'none', borderRadius: 6,
                            background: boardText.trim() ? '#0F172A' : '#E2E8F0',
                            color: boardText.trim() ? '#fff' : '#94A3B8',
                            fontSize: 12, fontWeight: 600,
                            cursor: boardText.trim() ? 'pointer' : 'default',
                            fontFamily: 'inherit',
                          }}
                        >
                          Parse Prescriptions →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parsed panel */}
                <ParsedPanel
                  parsedRxs={parsedRxs}
                  setParsedRxs={setParsedRxs}
                  updateParsed={updateParsed}
                  toggleTod={toggleTod}
                  saveAll={saveAll}
                  selectedPatient={selectedPatient}
                />
              </div>
            </>
          )}

          {/* STEP 3b: Mic mode */}
          {mode === 'mic' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => { setMode(null); if (isListening) recognitionRef.current?.stop(); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 13, color: '#64748B', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 2L4 7l5 5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Back to mode selection
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Mic control card */}
                  <div style={{
                    background: '#fff', border: '1px solid #D9E8EF', borderRadius: 12,
                    padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                  }}>
                    {/* Mic button */}
                    <div style={{ position: 'relative' }}>
                      {isListening && (
                        <>
                          <div style={{
                            position: 'absolute', inset: -12, borderRadius: '50%',
                            border: '2px solid #0AADA8', opacity: 0.35,
                            animation: 'pulse-ring 1.5s ease-out infinite',
                          }} />
                          <div style={{
                            position: 'absolute', inset: -24, borderRadius: '50%',
                            border: '2px solid #0AADA8', opacity: 0.15,
                            animation: 'pulse-ring 1.5s ease-out infinite 0.5s',
                          }} />
                        </>
                      )}
                      <button
                        onClick={micSupported ? toggleMic : undefined}
                        style={{
                          width: 88, height: 88, borderRadius: '50%',
                          background: isListening ? '#0AADA8' : '#0F172A',
                          border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: micSupported ? 'pointer' : 'not-allowed',
                          transition: 'background 0.2s, transform 0.1s',
                          transform: ripple ? 'scale(0.93)' : 'scale(1)',
                          boxShadow: isListening
                            ? '0 0 0 6px rgba(10,173,168,0.2)'
                            : '0 4px 16px rgba(15,23,42,0.25)',
                        }}
                      >
                        {isListening ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <rect x="6" y="6" width="12" height="12" rx="2" fill="#fff"/>
                          </svg>
                        ) : (
                          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                            <rect x="10" y="3" width="10" height="16" rx="5" fill="#fff"/>
                            <path d="M5 15a10 10 0 0020 0" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M15 25v3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M10 28h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                    </div>

                    {!micSupported ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#DC2626', marginBottom: 4 }}>Microphone not supported</div>
                        <div style={{ fontSize: 13, color: '#64748B' }}>Your browser does not support the Web Speech API.</div>
                      </div>
                    ) : isListening ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#0AADA8' }}>Listening…</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18 }}>
                            {[5, 10, 14, 9, 6, 11, 5].map((h, i) => (
                              <div key={i} style={{
                                width: 3, height: h, borderRadius: 2, background: '#0AADA8',
                                animation: `bar-bounce 0.8s ease-in-out infinite`,
                                animationDelay: `${i * 0.1}s`,
                              }} />
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                          Speak clearly: <em>"Amoxicillin 500mg three times daily for 7 days after food"</em>
                        </div>
                        {transcript && (
                          <div style={{ fontSize: 13, color: '#0AADA8', fontStyle: 'italic', marginTop: 6 }}>
                            Hearing: "{transcript}"
                          </div>
                        )}
                        <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>Tap the button to stop</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                          Tap to start dictating
                        </div>
                        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                          Say the drug name, dose, frequency, and duration.<br />
                          <span style={{ color: '#94A3B8', fontSize: 12 }}>
                            e.g. "Metformin 500mg twice daily for 30 days after food"
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transcript / text view */}
                  {boardText && (
                    <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 18px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Dictated Prescriptions</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { setBoardText(''); setParsedRxs([]); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94A3B8', fontFamily: 'inherit' }}
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => setParsedRxs(parseRxText(boardText))}
                            style={{
                              padding: '4px 14px', border: 'none', borderRadius: 5,
                              background: '#0F172A', color: '#fff',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Parse →
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: '14px 18px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#0F172A', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {boardText}
                      </div>
                    </div>
                  )}
                </div>

                {/* Parsed panel */}
                <ParsedPanel
                  parsedRxs={parsedRxs}
                  setParsedRxs={setParsedRxs}
                  updateParsed={updateParsed}
                  toggleTod={toggleTod}
                  saveAll={saveAll}
                  selectedPatient={selectedPatient}
                />
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes bar-bounce {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
}

function ParsedPanel({
  parsedRxs, setParsedRxs, updateParsed, toggleTod, saveAll, selectedPatient,
}: {
  parsedRxs: ParsedRx[];
  setParsedRxs: React.Dispatch<React.SetStateAction<ParsedRx[]>>;
  updateParsed: (id: string, field: keyof ParsedRx, value: unknown) => void;
  toggleTod: (id: string, tod: TimeOfDay) => void;
  saveAll: () => void;
  selectedPatient: Patient;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Parsed Orders</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>Review and edit before saving</div>
          </div>
          {parsedRxs.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: '#0AADA8', color: '#fff', borderRadius: 20 }}>
              {parsedRxs.length}
            </span>
          )}
        </div>

        {parsedRxs.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              Write or dictate prescriptions, then parse them here
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {parsedRxs.map((rx, i) => (
              <div key={rx.id} style={{
                padding: '16px 20px',
                borderBottom: i < parsedRxs.length - 1 ? '1px solid #D9E8EF' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, background: '#D4F0EF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#0AADA8', flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <input
                    value={rx.drug}
                    onChange={e => updateParsed(rx.id, 'drug', e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #D9E8EF', borderRadius: 5, fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: 'inherit', outline: 'none', background: '#F8FBFC' }}
                  />
                  <button
                    onClick={() => setParsedRxs(prev => prev.filter(r => r.id !== rx.id))}
                    style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2, fontSize: 16, lineHeight: 1 }}
                  >×</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <div>
                    <div style={fLabel}>Dose</div>
                    <input value={rx.dose} onChange={e => updateParsed(rx.id, 'dose', e.target.value)} style={fInput} />
                  </div>
                  <div>
                    <div style={fLabel}>Route</div>
                    <select value={rx.route} onChange={e => updateParsed(rx.id, 'route', e.target.value)} style={fInput}>
                      {ROUTE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <div>
                    <div style={fLabel}>Frequency</div>
                    <select value={rx.frequency} onChange={e => updateParsed(rx.id, 'frequency', e.target.value)} style={fInput}>
                      {FREQ_OPTIONS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={fLabel}>Duration (days)</div>
                    <input type="number" min={1} max={365} value={rx.durationDays} onChange={e => updateParsed(rx.id, 'durationDays', parseInt(e.target.value) || 1)} style={fInput} />
                  </div>
                </div>

                <div style={{ marginBottom: 6 }}>
                  <div style={fLabel}>Food Timing</div>
                  <select value={rx.foodTiming} onChange={e => updateParsed(rx.id, 'foodTiming', e.target.value)} style={fInput}>
                    {FOOD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div>
                  <div style={fLabel}>Time of Day</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {TOD_OPTIONS.map(t => {
                      const on = rx.timeOfDay.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleTod(rx.id, t)}
                          style={{
                            padding: '3px 10px', border: 'none', borderRadius: 20,
                            background: on ? '#0AADA8' : '#F0F9FB',
                            color: on ? '#fff' : '#64748B',
                            fontSize: 11, fontWeight: on ? 600 : 400,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {parsedRxs.length > 0 && (
        <button
          onClick={saveAll}
          style={{
            padding: '12px 0', border: 'none', borderRadius: 8,
            background: '#0AADA8', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          Save {parsedRxs.length} prescription{parsedRxs.length > 1 ? 's' : ''} to {selectedPatient.name}
        </button>
      )}
    </div>
  );
}

const fLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#94A3B8',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
};

const fInput: React.CSSProperties = {
  width: '100%', padding: '5px 8px', border: '1px solid #D9E8EF',
  borderRadius: 5, fontSize: 12, color: '#0F172A',
  fontFamily: 'inherit', outline: 'none', background: '#F8FBFC',
  boxSizing: 'border-box',
};
