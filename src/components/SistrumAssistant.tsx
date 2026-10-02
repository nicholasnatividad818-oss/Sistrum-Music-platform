import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Sparkles, Send, Trash2, Loader2, Bot, User, X } from 'lucide-react';
import {
  sendAssistantMessage,
  fetchAiProviders,
  AssistantHistoryItem,
  AiProviderId,
  AiProviderStatus,
} from '../services/assistant';

const PROVIDERS: { id: AiProviderId; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: AiProviderId;
}

export function SistrumAssistant({ onUpgrade }: { onUpgrade?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [provider, setProvider] = useState<AiProviderId>('chatgpt');
  const [connections, setConnections] = useState<AiProviderStatus[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiProviders()
      .then((list) => {
        if (!cancelled) setConnections(list);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = connections.find((item) => item.id === provider);
  const needsKey = active ? !active.configured : false;

  // Auto-scroll on new messages or loading
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || needsKey) return;
    if (trimmed.length > 2000) {
      setError('Message too long (max 2000 characters).');
      return;
    }
    setError(null);
    setUpgradeRequired(false);
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    const history: AssistantHistoryItem[] = nextMessages.slice(-11, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await sendAssistantMessage(trimmed, history, provider);
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        provider: result.provider,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const failure = err as Error & { upgrade?: boolean };
      setUpgradeRequired(Boolean(failure?.upgrade));
      setError(failure?.message || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      {/* Floating AI Button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff4400] to-[#ff7700] text-white shadow-xl shadow-[#ff5500]/30 flex items-center justify-center hover:scale-105 transition-transform border border-white/10"
        aria-label="Open Sistrum AI"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* Side Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          {/* Panel */}
          <div className="w-full max-w-[380px] h-full bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-4 py-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#ff5500] flex items-center justify-center text-white shadow-md shadow-[#ff5500]/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black tracking-widest text-white">SISTRUM AI</div>
                  <div className="text-[11px] text-neutral-500">
                    {active ? `${active.label} · ${active.model}` : 'Ask about your music, catalog, or releases'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClear}
                title="Clear conversation"
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950/40 flex flex-wrap gap-1.5">
              {PROVIDERS.map(({ id, label }) => {
                const status = connections.find((item) => item.id === id);
                const selected = provider === id;
                const connected = status?.configured;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setProvider(id);
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${
                      selected
                        ? 'bg-[#ff5500]/15 border-[#ff5500]/50 text-white'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        connected === undefined ? 'bg-neutral-600' : connected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#0b0b0f]">
              {messages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto text-neutral-500">
                    <Sparkles className="w-6 h-6 text-[#ff5500]" />
                  </div>
                  <div className="text-xs text-neutral-500 leading-relaxed">
                    Ask about song metadata, release planning, descriptions, tags, catalog organization, songwriting or production.
                    <br />
                    <span className="text-neutral-600">I don’t modify data directly — I guide you.</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                    {['Improve my track title', 'Suggest tags for Lo-Fi', 'Release checklist?'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInput(s)}
                        className="px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[11px] font-semibold text-neutral-300 hover:text-white transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-[#ff5500]/15 border border-[#ff5500]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-[#ff5500]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap border ${
                      m.role === 'user'
                        ? 'bg-[#ff5500] text-white border-[#ff5500] rounded-br-md'
                        : 'bg-neutral-800 text-neutral-100 border-neutral-700 rounded-bl-md'
                    }`}
                  >
                    {m.content}
                    {m.role === 'assistant' && m.provider && (
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
                        {connections.find((item) => item.id === m.provider)?.label || m.provider}
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#ff5500]/15 border border-[#ff5500]/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[#ff5500]" />
                  </div>
                  <div className="bg-neutral-800 border border-neutral-700 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-neutral-400">
                    <Loader2 className="w-4 h-4 animate-spin text-[#ff5500]" />
                    Thinking...
                  </div>
                </div>
              )}
              {error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300 space-y-2">
                  <p>{error}</p>
                  {upgradeRequired && onUpgrade && (
                    <button
                      type="button"
                      onClick={onUpgrade}
                      className="px-3 py-1.5 rounded-lg bg-[#ff5500] text-white font-bold"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-900">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Sistrum AI..."
                  rows={1}
                  className="flex-1 min-h-[44px] max-h-24 bg-neutral-950 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#ff5500] outline-none resize-none leading-5"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading || !input.trim() || needsKey}
                  className="h-[44px] px-4 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
              <div className="text-[10px] text-neutral-600 text-center mt-2">
                {needsKey && active
                  ? `${active.label} needs ${active.env} on the server`
                  : 'Enter to send • Shift+Enter for newline • Max 2000 chars'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
