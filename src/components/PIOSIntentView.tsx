import { useMemo, useState } from 'react';
import { Activity, Lock, Send, Shield, Trash2 } from 'lucide-react';
import { PIOSConsentPolicy, PIOSIntent, PIOSIntentScope } from '../types';
import {
  clearPIOSIntents,
  createPIOSIntent,
  getPIOSPolicy,
  listPIOSIntents,
  savePIOSPolicy,
  sendPIOSIntent
} from '../services/piosIntent';

const CURRENT_USER_ID = 'current-user';

export function PIOSIntentView() {
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [scope, setScope] = useState<PIOSIntentScope>('direct');
  const [policy, setPolicy] = useState<PIOSConsentPolicy>(() => getPIOSPolicy());
  const [intents, setIntents] = useState<PIOSIntent[]>(() => listPIOSIntents());
  const [status, setStatus] = useState('PIOS local intent channel ready.');
  const [isSending, setIsSending] = useState(false);

  const canSend = useMemo(() => {
    if (!message.trim()) return false;
    if (scope === 'direct' && !recipientId.trim()) return false;
    if (scope === 'direct' && !policy.allowDirectIntents) return false;
    if (scope === 'circle' && !policy.allowCircleIntents) return false;
    return true;
  }, [message, recipientId, scope, policy]);

  const updatePolicy = (patch: Partial<PIOSConsentPolicy>) => {
    const next = { ...policy, ...patch };
    setPolicy(next);
    savePIOSPolicy(next);
  };

  const handleSend = async () => {
    if (!canSend || isSending) return;
    setIsSending(true);

    try {
      const intent = createPIOSIntent({
        senderId: CURRENT_USER_ID,
        recipientId: scope === 'direct' ? recipientId.trim() : undefined,
        scope,
        source: 'text',
        rawInput: message,
        semanticPayload: message,
        confidence: 1
      });

      const sent = await sendPIOSIntent(intent);
      setIntents(listPIOSIntents());
      setMessage('');
      setStatus(`Intent ${sent.id.slice(-6)} sent through the local transport adapter.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown PIOS error';
      setStatus(reason);
      setIntents(listPIOSIntents());
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    clearPIOSIntents();
    setIntents([]);
    setStatus('Local PIOS audit history cleared.');
  };

  return (
    <section className="pb-36 space-y-6">
      <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-[#111118] to-neutral-950 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-neutral-800/80">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[#ff5500] text-xs font-black uppercase tracking-[0.22em] mb-2">
                <Activity className="w-4 h-4" />
                PIOS Intent Layer · v0.1
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Communicate intent, not raw thought.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                Sistrum converts an intentional input into a bounded semantic payload, checks the consent policy,
                and only then allows transmission. Sensor adapters can plug into this layer later without bypassing privacy controls.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">
              <Lock className="w-4 h-4" />
              Raw neural data transport: disabled
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-0">
          <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-neutral-800/80 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Transmission scope</span>
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value as PIOSIntentScope)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-[#ff5500]"
                >
                  <option value="private">Private / no transmission</option>
                  <option value="direct">Direct recipient</option>
                  <option value="circle">Trusted circle</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Recipient identity</span>
                <input
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  disabled={scope !== 'direct'}
                  placeholder="artist-id, handle, DID..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#ff5500] disabled:opacity-40"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">Intent payload</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Example: Meet me in the studio at 8. Bring the alternate master."
                rows={6}
                className="w-full resize-none rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-4 text-sm leading-6 text-white placeholder-neutral-600 outline-none focus:border-[#ff5500]"
              />
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-neutral-500">{status}</p>
              <button
                onClick={handleSend}
                disabled={!canSend || isSending || scope === 'private'}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-[#ff5500]/20 transition hover:bg-[#ff6611] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Explicit Send'}
              </button>
            </div>
          </div>

          <aside className="p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff5500]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Consent policy</h2>
            </div>

            <PolicyToggle
              label="Allow direct intents"
              description="Permit one-to-one transmissions."
              checked={policy.allowDirectIntents}
              onChange={(checked) => updatePolicy({ allowDirectIntents: checked })}
            />
            <PolicyToggle
              label="Allow circle intents"
              description="Permit transmission to a trusted group."
              checked={policy.allowCircleIntents}
              onChange={(checked) => updatePolicy({ allowCircleIntents: checked })}
            />
            <PolicyToggle
              label="Require explicit send"
              description="Candidate intents never transmit automatically."
              checked={policy.requireExplicitSend}
              onChange={(checked) => updatePolicy({ requireExplicitSend: checked })}
            />
            <PolicyToggle
              label="Retain raw input"
              description="Off by default. Semantic payload is preferred."
              checked={policy.retainRawInput}
              onChange={(checked) => updatePolicy({ retainRawInput: checked })}
            />
          </aside>
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-800 bg-neutral-950/70 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-black text-white">Local intent audit</h2>
            <p className="mt-1 text-xs text-neutral-500">Latest policy-reviewed intent events stored in this browser.</p>
          </div>
          <button
            onClick={handleClear}
            disabled={intents.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-xs font-bold text-neutral-400 hover:text-white hover:border-neutral-700 disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>

        {intents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-600">
            No intent events yet.
          </div>
        ) : (
          <div className="space-y-2">
            {intents.slice(0, 12).map((intent) => (
              <div key={intent.id} className="grid md:grid-cols-[1fr_auto] gap-3 rounded-2xl border border-neutral-800/80 bg-[#0d0d12] p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-300">
                      {intent.scope}
                    </span>
                    <span className="rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-300">
                      {intent.source}
                    </span>
                    <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                      intent.status === 'sent'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : intent.status === 'blocked'
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {intent.status}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-white">{intent.semanticPayload}</p>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    {intent.recipientId ? `to ${intent.recipientId} · ` : ''}{new Date(intent.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="self-center text-right text-[11px] text-neutral-500">
                  confidence<br />
                  <span className="font-mono text-neutral-300">{Math.round(intent.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PolicyToggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#ff5500]"
      />
      <span>
        <span className="block text-xs font-bold text-white">{label}</span>
        <span className="mt-1 block text-[11px] leading-4 text-neutral-500">{description}</span>
      </span>
    </label>
  );
}
