import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../api/chatbot';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const SUGGESTIONS = [
  'What are the interactions between Warfarin and Aspirin?',
  'How should Metformin be administered for a diabetic patient?',
  'What is the reorder level protocol for critical drugs?',
  'Explain the difference between TDS and QDS dosing.',
  'What should I check before dispensing an antibiotic?',
  'How do I handle a Stop Order for a controlled drug?',
];

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function renderContent(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const [header, , ...rows] = tableLines;
      const headers = header.split('|').filter(Boolean).map(h => h.trim());
      elements.push(
        <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} style={{ padding: '6px 12px', background: '#F0F9FB', color: '#0AADA8', fontWeight: 600, borderBottom: '2px solid #D4F0EF', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.split('|').filter(Boolean).map((cell, ci) => (
                    <td key={ci} style={{ padding: '6px 12px', borderBottom: '1px solid #D9E8EF', color: '#0F172A', verticalAlign: 'top' }}>
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Heading ##
    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <div key={`h-${i}`} style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: '14px 0 6px' }}>
          {line.replace(/\*\*/g, '')}
        </div>
      );
      i++;
      continue;
    }

    // Bullet
    if (line.startsWith('- ') || line.startsWith('✅') || line.startsWith('🔴') || line.startsWith('🟡') || line.startsWith('🟢') || line.startsWith('💊') || line.startsWith('📋') || line.startsWith('🏥') || line.startsWith('📦') || line.startsWith('🩺') || line.startsWith('🔬')) {
      elements.push(
        <div key={`li-${i}`} style={{ fontSize: 13, color: '#0F172A', padding: '2px 0 2px 4px', lineHeight: 1.6 }}>
          {renderInline(line.replace(/^- /, ''))}
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\./.test(line)) {
      elements.push(
        <div key={`nl-${i}`} style={{ fontSize: 13, color: '#0F172A', padding: '2px 0', lineHeight: 1.6 }}>
          {renderInline(line)}
        </div>
      );
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <div key={`p-${i}`} style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.7, marginBottom: 4 }}>
        {renderInline(line)}
      </div>
    );
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: '#0F172A' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: '#F0F9FB', padding: '1px 5px', borderRadius: 3, color: '#0AADA8' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

let idCounter = 0;
function uid() { return `${Date.now()}-${++idCounter}`; }

function getSessionId(): string {
  const KEY = 'pharmassist-chat-session';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uid();
    localStorage.setItem(KEY, id);
  }
  return id;
}

interface ChatAssistantProps {
  patientMrn?: string;
}

export default function ChatAssistant({ patientMrn }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => { if (open) { scrollToBottom(); inputRef.current?.focus(); } }, [open, activeId, scrollToBottom]);

  const newChat = () => {
    const conv: Conversation = {
      id: uid(),
      title: 'New conversation',
      messages: [],
      createdAt: new Date(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    setInput('');
  };

  const handleOpen = () => {
    setOpen(true);
    if (!activeId) newChat();
  };

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    let convId = activeId;
    if (!convId) {
      const conv: Conversation = { id: uid(), title: trimmed.slice(0, 40), messages: [], createdAt: new Date() };
      setConversations(prev => [conv, ...prev]);
      setActiveId(conv.id);
      convId = conv.id;
    }

    const userMsg: Message = { id: uid(), role: 'user', content: trimmed, timestamp: new Date() };

    setConversations(prev => prev.map(c =>
      c.id === convId
        ? {
            ...c,
            title: c.messages.length === 0 ? trimmed.slice(0, 42) + (trimmed.length > 42 ? '…' : '') : c.title,
            messages: [...c.messages, userMsg],
          }
        : c
    ));
    setInput('');
    setIsTyping(true);
    scrollToBottom();

    let response: string;
    try {
      response = await sendChatMessage(trimmed, getSessionId(), patientMrn ?? '');
    } catch {
      response = '⚠️ Assistant is unavailable right now. Please try again in a moment.';
    }
    const assistantMsg: Message = { id: uid(), role: 'assistant', content: response, timestamp: new Date() };

    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, assistantMsg] } : c
    ));
    setIsTyping(false);
    scrollToBottom();
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      newChat();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Group conversations by date
  const grouped = conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
    const label = formatDate(c.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(c);
    return acc;
  }, {});

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%',
          background: '#0AADA8',
          border: 'none',
          boxShadow: '0 4px 20px rgba(10,173,168,0.4)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(10,173,168,0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,173,168,0.4)';
        }}
        title="Pharmassist AI"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5L2 22l5.2-1.32A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#fff"/>
          <circle cx="8.5" cy="12" r="1.2" fill="#0AADA8"/>
          <circle cx="12" cy="12" r="1.2" fill="#0AADA8"/>
          <circle cx="15.5" cy="12" r="1.2" fill="#0AADA8"/>
        </svg>
        {!open && conversations.length === 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#0F172A', color: '#fff', fontSize: 9, fontWeight: 700,
            padding: '2px 5px', borderRadius: 8, lineHeight: 1.4,
            border: '2px solid #E8F3F8', whiteSpace: 'nowrap',
          }}>
            AI
          </span>
        )}
      </button>

      {/* Chat overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(2px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 980, height: '88vh', maxHeight: 760,
            background: '#fff', borderRadius: 16, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(15,23,42,0.28)',
          }}>
            {/* Top bar */}
            <div style={{
              height: 52, background: '#fff', borderBottom: '1px solid #D9E8EF',
              display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16, gap: 12,
              flexShrink: 0,
            }}>
              <button
                onClick={() => setSidebarOpen(s => !s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#64748B', display: 'flex', alignItems: 'center' }}
                title="Toggle sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3.5" width="12" height="1.3" rx="0.65" fill="currentColor"/>
                  <rect x="2" y="7.35" width="12" height="1.3" rx="0.65" fill="currentColor"/>
                  <rect x="2" y="11.2" width="12" height="1.3" rx="0.65" fill="currentColor"/>
                </svg>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: '#0AADA8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M7.5 1C4.462 1 2 3.462 2 6.5c0 .91.244 1.765.67 2.5L2 13l4.1-.66A5.48 5.48 0 007.5 12c3.038 0 5.5-2.462 5.5-5.5S10.538 1 7.5 1z" fill="#fff"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>Pharmassist AI</div>
                  <div style={{ fontSize: 11, color: '#16A34A', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                    Clinical pharmacy assistant
                  </div>
                </div>
              </div>

              <button
                onClick={newChat}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', border: '1px solid #D9E8EF', borderRadius: 7,
                  background: '#F8FBFC', color: '#0F172A', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                New chat
              </button>

              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#94A3B8', fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Sidebar */}
              {sidebarOpen && (
                <div style={{
                  width: 240, flexShrink: 0, background: '#0F172A',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
                    {conversations.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '24px 12px', lineHeight: 1.6 }}>
                        No conversations yet.<br />Start a new chat above.
                      </div>
                    ) : (
                      Object.entries(grouped).map(([dateLabel, convs]) => (
                        <div key={dateLabel}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px', marginTop: 6 }}>
                            {dateLabel}
                          </div>
                          {convs.map(conv => (
                            <div
                              key={conv.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                borderRadius: 7, marginBottom: 2,
                                background: conv.id === activeId ? 'rgba(10,173,168,0.18)' : 'transparent',
                                transition: 'background 0.1s',
                              }}
                              onMouseEnter={e => { if (conv.id !== activeId) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                              onMouseLeave={e => { if (conv.id !== activeId) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <button
                                onClick={() => setActiveId(conv.id)}
                                style={{
                                  flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                                  textAlign: 'left', padding: '8px 10px',
                                  fontFamily: 'inherit', fontSize: 12.5,
                                  color: conv.id === activeId ? '#5FF5EF' : 'rgba(255,255,255,0.72)',
                                  fontWeight: conv.id === activeId ? 600 : 400,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 7, flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
                                  <path d="M6 1C3.24 1 1 3.24 1 6c0 .728.195 1.412.536 2L1 11l3.08-.497A4.963 4.963 0 006 11c2.76 0 5-2.24 5-5S8.76 1 6 1z" stroke="currentColor" strokeWidth="1.1" fill="none"/>
                                </svg>
                                {conv.title}
                              </button>
                              <button
                                onClick={() => deleteConversation(conv.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: 5,
                                  fontSize: 14, lineHeight: 1, flexShrink: 0,
                                  opacity: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#FCA5A5'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                                title="Delete conversation"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Sidebar footer */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#D4F0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0AADA8', flexShrink: 0 }}>
                        AI
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Pharmassist AI</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Clinical assistant · v1</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Main chat area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FBFC' }}>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(!activeConv || activeConv.messages.length === 0) ? (
                    /* Empty state */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 40px' }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%', background: '#D4F0EF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                      }}>
                        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                          <path d="M15 3C8.373 3 3 8.373 3 15c0 2.274.609 4.41 1.672 6.25L3 27l5.875-1.65A11.934 11.934 0 0015 27c6.627 0 12-5.373 12-12S21.627 3 15 3z" fill="#0AADA8"/>
                          <circle cx="10.5" cy="15" r="1.8" fill="#fff"/>
                          <circle cx="15" cy="15" r="1.8" fill="#fff"/>
                          <circle cx="19.5" cy="15" r="1.8" fill="#fff"/>
                        </svg>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                        How can I help you today?
                      </div>
                      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 28, lineHeight: 1.6 }}>
                        Ask me about drug interactions, dosing protocols,<br />dispensing guidelines, or any clinical pharmacy question.
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 560 }}>
                        {SUGGESTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => sendMessage(s)}
                            style={{
                              padding: '10px 14px', border: '1px solid #D9E8EF', borderRadius: 8,
                              background: '#fff', color: '#0F172A', fontSize: 12, cursor: 'pointer',
                              fontFamily: 'inherit', textAlign: 'left', lineHeight: 1.5,
                              transition: 'all 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0AADA8'; e.currentTarget.style.background = '#F0FAFA'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D9E8EF'; e.currentTarget.style.background = '#fff'; }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeConv.messages.map((msg) => (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                            gap: 10, marginBottom: 16, alignItems: 'flex-start',
                          }}
                        >
                          {/* Avatar */}
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: msg.role === 'user' ? '#D4F0EF' : '#0F172A',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: msg.role === 'user' ? 11 : 12, fontWeight: 700,
                            color: msg.role === 'user' ? '#0AADA8' : '#fff',
                            marginTop: 2,
                          }}>
                            {msg.role === 'user' ? 'You' : (
                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path d="M7.5 1C4.462 1 2 3.462 2 6.5c0 .91.244 1.765.67 2.5L2 13l4.1-.66A5.48 5.48 0 007.5 12c3.038 0 5.5-2.462 5.5-5.5S10.538 1 7.5 1z" fill="#0AADA8"/>
                              </svg>
                            )}
                          </div>

                          <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {msg.role === 'user' ? (
                              <div style={{
                                background: '#0AADA8', color: '#fff', borderRadius: '12px 12px 3px 12px',
                                padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
                              }}>
                                {msg.content}
                              </div>
                            ) : (
                              <div style={{
                                background: '#fff', border: '1px solid #D9E8EF',
                                borderRadius: '12px 12px 12px 3px',
                                padding: '12px 16px',
                              }}>
                                {renderContent(msg.content)}
                              </div>
                            )}

                            {/* Meta row */}
                            <div style={{
                              display: 'flex', gap: 8, alignItems: 'center',
                              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            }}>
                              <span style={{ fontSize: 10, color: '#94A3B8' }}>{formatTime(msg.timestamp)}</span>
                              {msg.role === 'assistant' && (
                                <button
                                  onClick={() => copyMessage(msg.id, msg.content)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '2px 4px', borderRadius: 4,
                                    color: copiedId === msg.id ? '#16A34A' : '#94A3B8',
                                    fontSize: 10, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
                                  }}
                                  title="Copy response"
                                >
                                  {copiedId === msg.id ? (
                                    <>
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 5l2 2 4-4" stroke="#16A34A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <rect x="3" y="1" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                                        <path d="M1.5 3h-.5a1 1 0 00-1 1v4.5a1 1 0 001 1H6a1 1 0 001-1v-.5" stroke="currentColor" strokeWidth="1.1"/>
                                      </svg>
                                      Copy
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Typing indicator */}
                      {isTyping && (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                              <path d="M7.5 1C4.462 1 2 3.462 2 6.5c0 .91.244 1.765.67 2.5L2 13l4.1-.66A5.48 5.48 0 007.5 12c3.038 0 5.5-2.462 5.5-5.5S10.538 1 7.5 1z" fill="#0AADA8"/>
                            </svg>
                          </div>
                          <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: '12px 12px 12px 3px', padding: '12px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
                            {[0, 1, 2].map(i => (
                              <div key={i} style={{
                                width: 7, height: 7, borderRadius: '50%', background: '#0AADA8',
                                animation: 'typing-dot 1.2s ease-in-out infinite',
                                animationDelay: `${i * 0.2}s`,
                              }} />
                            ))}
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input area */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid #D9E8EF', background: '#fff' }}>
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'flex-end',
                    background: '#F8FBFC', border: '1.5px solid #D9E8EF',
                    borderRadius: 12, padding: '10px 14px',
                    transition: 'border-color 0.15s',
                  }}
                    onFocusCapture={e => (e.currentTarget.style.borderColor = '#0AADA8')}
                    onBlurCapture={e => (e.currentTarget.style.borderColor = '#D9E8EF')}
                  >
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about drug interactions, dosing, protocols..."
                      rows={1}
                      style={{
                        flex: 1, border: 'none', background: 'transparent', outline: 'none',
                        fontSize: 13, color: '#0F172A', fontFamily: 'inherit', resize: 'none',
                        lineHeight: 1.6, maxHeight: 120, overflowY: 'auto',
                      }}
                      onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                      }}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isTyping}
                      style={{
                        width: 34, height: 34, borderRadius: 8, border: 'none',
                        background: input.trim() && !isTyping ? '#0AADA8' : '#D9E8EF',
                        color: input.trim() && !isTyping ? '#fff' : '#94A3B8',
                        cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'background 0.15s',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M14 8L2 2l3 6-3 6 12-6z" fill="currentColor"/>
                      </svg>
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'center', marginTop: 8 }}>
                    Enter to send · Shift+Enter for new line · Pharmassist AI may make mistakes — verify critical clinical decisions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
