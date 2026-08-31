import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { chatApi } from '../services/api';
import { LoadingSpinner, EmptyState } from '../components/UI/StateComponents';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`ks-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="ks-bubble" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
      {msg.created_at && (
        <div className="ks-message-meta">{formatTime(msg.created_at)}</div>
      )}
    </div>
  );
}

function ThinkingBubble({ text }) {
  return (
    <div className="ks-message assistant">
      <div className="ks-bubble" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {[0, 0.15, 0.3].map((d, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ks-green-400)', display: 'inline-block', animation: `blink 1s ${d}s infinite` }} />
          ))}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ks-text-3)' }}>{text}</span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('kn') ? 'kn' : 'en';

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState('sessions'); // 'sessions' | 'chat'

  // Voice
  const [recording, setRecording] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // idle | recording | transcribing
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Load sessions
  useEffect(() => {
    chatApi.getSessions()
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { if (view === 'chat') scrollToBottom(); }, [messages, view]);

  const openSession = async (session) => {
    setActiveSession(session);
    setView('chat');
    setMessages([]);
    try {
      const { data } = await chatApi.getMessages(session.id);
      setMessages(data.messages || []);
    } catch {}
  };

  const newSession = async () => {
    try {
      const { data } = await chatApi.createSession(lang);
      setSessions(prev => [data.session, ...prev]);
      openSession(data.session);
    } catch {}
  };

  const deleteSession = async (id) => {
    try {
      await chatApi.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSession?.id === id) { setView('sessions'); setActiveSession(null); setMessages([]); }
    } catch {}
  };

  const sendText = async () => {
    const q = input.trim();
    if (!q || sending || !activeSession) return;
    setInput('');
    const userMsg = { id: Date.now(), role: 'user', content: q, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);
    try {
      const { data } = await chatApi.sendQuery(activeSession.id, q, lang);
      const asstMsg = { id: Date.now() + 1, role: 'assistant', content: data.answer, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, asstMsg]);
      // Update session title in list
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, title: s.title === 'New conversation' ? q.slice(0, 60) : s.title } : s));
    } catch (err) {
      const errMsg = { id: Date.now() + 1, role: 'assistant', content: '⚠️ ' + (err?.response?.data?.error || t('common.serverError')), created_at: new Date().toISOString() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setThinking(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceState('transcribing');
        try {
          const { data } = await chatApi.sendVoiceQuery(activeSession.id, blob, lang);
          const userMsg = { id: Date.now(), role: 'user', content: data.transcribed_text, created_at: new Date().toISOString() };
          const asstMsg = { id: Date.now() + 1, role: 'assistant', content: data.answer, created_at: new Date().toISOString() };
          setMessages(prev => [...prev, userMsg, asstMsg]);
        } catch {
          const errMsg = { id: Date.now(), role: 'assistant', content: '⚠️ ' + t('common.serverError'), created_at: new Date().toISOString() };
          setMessages(prev => [...prev, errMsg]);
        } finally {
          setVoiceState('idle'); setRecording(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true); setVoiceState('recording');
    } catch {
      alert('Microphone permission denied. Please allow microphone access in your browser settings.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // Sessions list view
  if (view === 'sessions') {
    return (
      <div className="ks-page">
        <div className="ks-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>{t('chat.title')}</h1>
            <p style={{ margin: 0 }}>{t('chat.subtitle')}</p>
          </div>
          <button className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 14 }} onClick={newSession}>
            + {t('chat.newChat')}
          </button>
        </div>
        <div className="ks-page-content">
          {loadingSessions ? <LoadingSpinner /> : sessions.length === 0 ? (
            <EmptyState icon="💬" title={t('chat.noSessions')} desc={t('chat.startChat')}
              action={<button className="btn btn-primary mt-3" onClick={newSession}>+ {t('chat.newChat')}</button>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map(s => (
                <div key={s.id} className="ks-history-item" style={{ background: 'white' }}>
                  <button style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => openSession(s)}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ks-text-3)', marginTop: 2 }}>{new Date(s.updated_at || s.created_at).toLocaleDateString()}</div>
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--ks-text-3)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                    onClick={() => { if (window.confirm(t('chat.confirmDelete'))) deleteSession(s.id); }}
                    aria-label={t('chat.deleteSession')}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 72px)' }}>
      {/* Chat header */}
      <div style={{ background: 'var(--ks-surface)', borderBottom: '1px solid var(--ks-border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0 }} onClick={() => setView('sessions')}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{activeSession?.title}</div>
          <div style={{ fontSize: 11, color: 'var(--ks-green-600)' }}>🤖 {t('chat.assistant')}</div>
        </div>
        <button className="btn btn-sm btn-outline-primary" style={{ fontSize: 12 }} onClick={newSession}>+ {t('chat.newChat')}</button>
      </div>

      {/* Messages */}
      <div className="ks-chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ks-text-3)', fontSize: 14 }}>
            💬 {t('chat.subtitle')}
          </div>
        )}
        {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
        {thinking && <ThinkingBubble text={t('chat.thinking')} />}
        {voiceState === 'transcribing' && <ThinkingBubble text={t('chat.transcribing')} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice recording bar */}
      {recording && (
        <div style={{ padding: '8px 16px', background: 'var(--ks-surface)', borderTop: '1px solid var(--ks-border)' }}>
          <div className="ks-recording-bar">
            <span className="ks-recording-dot" />
            <span>{t('chat.recording')}</span>
            <button className="btn btn-sm btn-danger ms-auto" onClick={stopRecording}>{t('chat.stopRecording')}</button>
          </div>
        </div>
      )}

      {/* Input area */}
      {!recording && (
        <div className="ks-chat-input-area">
          {/* Voice button */}
          <button
            className={`ks-voice-btn ${voiceState === 'idle' ? 'idle' : 'recording'}`}
            onClick={voiceState === 'idle' ? startRecording : stopRecording}
            aria-label={voiceState === 'idle' ? t('chat.voiceInput') : t('chat.stopRecording')}
            title={t('chat.voiceInput')}
          >
            🎤
          </button>

          <textarea
            className="form-control"
            rows={1}
            style={{ resize: 'none', borderRadius: 20, padding: '10px 16px', fontSize: 15 }}
            placeholder={t('chat.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
            aria-label={t('chat.placeholder')}
          />

          <button
            className="btn btn-primary"
            style={{ borderRadius: 20, padding: '10px 18px', flexShrink: 0 }}
            onClick={sendText}
            disabled={!input.trim() || sending}
            aria-label={t('chat.send')}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
