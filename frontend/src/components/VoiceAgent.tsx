import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SpeechRecognition shim                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string } | undefined;
}
interface ISpeechRecognitionResultList {
  readonly length: number;
  [index: number]: ISpeechRecognitionResult | undefined;
}
interface ISpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}
interface ISpeechRecognitionErrorEvent { readonly error: string }
interface ISpeechRecognition {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: ISpeechRecognitionErrorEvent) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => ISpeechRecognition;

function getSR(): SRCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { SpeechRecognition?: SRCtor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition ??
    null
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types & props                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceAgentProps {
  onRecognize: (transcript: string) => void;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Minimal inline icons (no lucide-react dependency here)                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function MicIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function MicOffIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function AlertIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Animated microphone button                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

const ACCENT = '#0AADA8';
const ACCENT_LIGHT = '#D4F0EF';
const CRITICAL = '#DC2626';
const CRITICAL_LIGHT = '#FEE2E2';
const BORDER = '#D9E8EF';
const TEXT_SECONDARY = '#64748B';

function MicButton({ state, onClick }: { state: VoiceState; onClick: () => void }) {
  const listening = state === 'listening';
  const processing = state === 'processing';
  const error = state === 'error';

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 168, height: 168 }}>
      {listening && (
        <>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '9999px', background: 'rgba(10,173,168,0.25)', animation: 'voiceAgentPing 1s cubic-bezier(0,0,0.2,1) infinite' }} />
          <span style={{ position: 'absolute', inset: -16, borderRadius: '9999px', background: 'rgba(10,173,168,0.12)', animation: 'voiceAgentPing 1.6s cubic-bezier(0,0,0.2,1) infinite', animationDelay: '0.25s' }} />
          <span style={{ position: 'absolute', inset: -32, borderRadius: '9999px', background: 'rgba(10,173,168,0.08)', animation: 'voiceAgentPing 2s cubic-bezier(0,0,0.2,1) infinite', animationDelay: '0.5s' }} />
        </>
      )}
      {processing && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '9999px',
            border: '4px solid transparent',
            borderTopColor: ACCENT,
            animation: 'voiceAgentSpin 0.75s linear infinite',
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={listening ? 'Stop' : 'Start voice input'}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: 128,
          height: 128,
          borderRadius: '9999px',
          borderWidth: 4,
          borderStyle: 'solid',
          borderColor: listening ? ACCENT : processing ? 'rgba(10,173,168,0.5)' : error ? 'rgba(220,38,38,0.4)' : BORDER,
          background: listening ? ACCENT : processing ? ACCENT_LIGHT : error ? CRITICAL_LIGHT : '#fff',
          color: listening ? '#fff' : processing ? ACCENT : error ? CRITICAL : TEXT_SECONDARY,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
          userSelect: 'none',
        }}
      >
        {listening ? (
          <>
            <MicOffIcon size={32} />
            <span style={{ fontSize: 11 }}>Stop</span>
          </>
        ) : processing ? (
          <>
            <MicIcon size={32} />
            <span style={{ fontSize: 11 }}>Processing…</span>
          </>
        ) : (
          <>
            <MicIcon size={32} />
            <span style={{ fontSize: 11 }}>Speak</span>
          </>
        )}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Live sound wave bars                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

function SoundWave({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 36 }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            borderRadius: '9999px',
            background: 'rgba(10,173,168,0.8)',
            animation: `voiceAgentSoundBar 0.5s ease-in-out ${i * 0.05}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main VoiceAgent component                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function VoiceAgent({ onRecognize }: VoiceAgentProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<ISpeechRecognition | null>(null);
  const SR = getSR();

  const startListening = useCallback(() => {
    if (!SR) { setVoiceState('error'); return; }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    rec.onstart = () => {
      setVoiceState('listening');
      setTranscript('');
      setInterim('');
    };

    rec.onresult = (e: ISpeechRecognitionEvent) => {
      let fin = '';
      let int_ = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        (r.isFinal ? (fin += r[0]?.transcript ?? '') : (int_ += r[0]?.transcript ?? ''));
      }
      if (int_) setInterim(int_);
      if (fin) { setTranscript(fin.trim()); setInterim(''); }
    };

    rec.onend = () => { setVoiceState('processing'); setInterim(''); };

    rec.onerror = (e: ISpeechRecognitionErrorEvent) => {
      console.error('Speech error:', e.error);
      setVoiceState(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'error' : 'idle');
    };

    recRef.current = rec;
    rec.start();
  }, [SR]);

  const stopListening = useCallback(() => recRef.current?.stop(), []);

  const reset = useCallback(() => {
    setVoiceState('idle');
    setTranscript('');
    setInterim('');
  }, []);

  /* ── When recognition ends → hand the final transcript to the parent ────── */
  useEffect(() => {
    if (voiceState !== 'processing') return;
    if (transcript) onRecognize(transcript.trim());
    reset();
  }, [voiceState, transcript, onRecognize, reset]);

  useEffect(() => () => recRef.current?.abort(), []);

  return (
    <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: 20 }}>
      <style>{`
        @keyframes voiceAgentPing {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes voiceAgentSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes voiceAgentSoundBar {
          from { height: 4px; }
          to { height: 24px; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
        <MicButton
          state={voiceState}
          onClick={voiceState === 'listening' ? stopListening : voiceState === 'idle' || voiceState === 'error' ? startListening : reset}
        />
        <SoundWave active={voiceState === 'listening'} />

        <div style={{ minHeight: 32, textAlign: 'center', padding: '0 16px' }}>
          {voiceState === 'idle' && (
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontWeight: 500, margin: 0 }}>
              Tap the microphone and say a medicine name
            </p>
          )}
          {voiceState === 'listening' && (
            <p style={{ fontSize: 15, fontWeight: 700, color: ACCENT, margin: 0 }}>
              {interim ? `"${interim}"` : 'Listening… speak clearly'}
            </p>
          )}
          {voiceState === 'processing' && (
            <p style={{ fontSize: 13, fontWeight: 600, color: TEXT_SECONDARY, margin: 0 }}>
              Processing…
            </p>
          )}
          {voiceState === 'error' && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: 13, fontWeight: 600, color: CRITICAL, margin: 0 }}>
              <AlertIcon size={16} color={CRITICAL} />
              Mic access denied — please enable microphone permission
            </p>
          )}
        </div>
      </div>

      {!SR && (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid rgba(220,38,38,0.3)',
            background: 'rgba(220,38,38,0.05)',
            padding: 12,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: CRITICAL,
          }}
        >
          Browser Speech Recognition is not supported. Use Google Chrome or Microsoft Edge.
        </div>
      )}
    </div>
  );
}
