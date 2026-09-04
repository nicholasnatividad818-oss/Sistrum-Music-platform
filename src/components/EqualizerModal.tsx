import { useState } from 'react';
import { EqualizerSettings } from '../types';
import { Sliders, X, Sparkles, Volume2, Disc } from 'lucide-react';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EqualizerSettings;
  onUpdateSettings: (newSettings: EqualizerSettings) => void;
}

export function EqualizerModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}: EqualizerModalProps) {
  if (!isOpen) return null;

  const presets: { id: EqualizerSettings['preset']; label: string; low: number; mid: number; high: number; bassBoost: boolean; cutoff: number }[] = [
    { id: 'flat', label: 'Flat / Studio', low: 0, mid: 0, high: 0, bassBoost: false, cutoff: 20000 },
    { id: 'bass-boost', label: 'Bass Subwoofer', low: 6, mid: 1, high: -1, bassBoost: true, cutoff: 18000 },
    { id: 'electronic', label: 'Electronic / Synth', low: 4, mid: -2, high: 5, bassBoost: true, cutoff: 20000 },
    { id: 'lofi', label: 'Vintage Lo-Fi Tape', low: 2, mid: 4, high: -8, bassBoost: false, cutoff: 7500 },
    { id: 'club', label: 'Club Rave', low: 5, mid: -1, high: 4, bassBoost: true, cutoff: 19000 },
    { id: 'vocal', label: 'Vocal Clarity', low: -3, mid: 6, high: 3, bassBoost: false, cutoff: 20000 }
  ];

  const handlePresetSelect = (p: typeof presets[0]) => {
    onUpdateSettings({
      preset: p.id,
      low: p.low,
      mid: p.mid,
      high: p.high,
      bassBoost: p.bassBoost,
      filterCutoff: p.cutoff
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff5500]/20 flex items-center justify-center text-[#ff5500]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Audio Master & Equalizer</h3>
              <p className="text-xs text-neutral-400">Web Audio 3-Band DSP & DJ Filter Processing</p>
            </div>
          </div>
          <button
            id="close-eq-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2.5">
              Equalizer Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => {
                const isActive = settings.preset === p.id;
                return (
                  <button
                    key={p.id}
                    id={`preset-${p.id}`}
                    onClick={() => handlePresetSelect(p)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all text-left flex items-center justify-between border ${
                      isActive
                        ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-md shadow-[#ff5500]/20'
                        : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border-neutral-700/50'
                    }`}
                  >
                    <span>{p.label}</span>
                    {isActive && <Sparkles className="w-3 h-3 text-white ml-1 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-Band EQ Sliders */}
          <div className="bg-neutral-950/60 rounded-xl p-4 border border-neutral-800/80">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Frequency Gain Control
              </span>
              <button
                onClick={() => handlePresetSelect(presets[0])}
                className="text-[11px] text-[#ff5500] hover:underline"
              >
                Reset to 0 dB
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              {/* Low / Bass */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs font-mono font-medium text-white">{settings.low > 0 ? `+${settings.low}` : settings.low} dB</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={settings.low}
                  onChange={(e) => onUpdateSettings({ ...settings, low: Number(e.target.value), preset: 'flat' })}
                  className="w-full accent-[#ff5500] cursor-pointer"
                />
                <span className="text-xs text-neutral-400 font-medium">Bass (250Hz)</span>
              </div>

              {/* Mid */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs font-mono font-medium text-white">{settings.mid > 0 ? `+${settings.mid}` : settings.mid} dB</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={settings.mid}
                  onChange={(e) => onUpdateSettings({ ...settings, mid: Number(e.target.value), preset: 'flat' })}
                  className="w-full accent-[#ff5500] cursor-pointer"
                />
                <span className="text-xs text-neutral-400 font-medium">Mids (1.5kHz)</span>
              </div>

              {/* High / Treble */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs font-mono font-medium text-white">{settings.high > 0 ? `+${settings.high}` : settings.high} dB</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={settings.high}
                  onChange={(e) => onUpdateSettings({ ...settings, high: Number(e.target.value), preset: 'flat' })}
                  className="w-full accent-[#ff5500] cursor-pointer"
                />
                <span className="text-xs text-neutral-400 font-medium">Treble (6kHz)</span>
              </div>
            </div>
          </div>

          {/* Bass Boost & DJ Cutoff Filter */}
          <div className="grid grid-cols-2 gap-4">
            {/* Bass Boost Toggle */}
            <div
              onClick={() => onUpdateSettings({ ...settings, bassBoost: !settings.bassBoost })}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                settings.bassBoost
                  ? 'bg-[#ff5500]/15 border-[#ff5500] text-white'
                  : 'bg-neutral-800/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Disc className={`w-5 h-5 ${settings.bassBoost ? 'text-[#ff5500] animate-spin' : 'text-neutral-500'}`} />
                <div>
                  <div className="text-xs font-bold">Sub-Bass Boost</div>
                  <div className="text-[10px] text-neutral-400">+6 dB Ultra Low</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  settings.bassBoost ? 'bg-[#ff5500] border-[#ff5500]' : 'border-neutral-600'
                }`}
              >
                {settings.bassBoost && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>

            {/* Lowpass DJ Filter */}
            <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-800/40 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-200 mb-1">
                <span>DJ Filter Cutoff</span>
                <span className="font-mono text-[10px] text-[#ff5500]">{Math.round(settings.filterCutoff)} Hz</span>
              </div>
              <input
                type="range"
                min="500"
                max="20000"
                step="250"
                value={settings.filterCutoff}
                onChange={(e) => onUpdateSettings({ ...settings, filterCutoff: Number(e.target.value) })}
                className="w-full accent-[#ff5500] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950/80 border-t border-neutral-800 flex justify-end">
          <button
            id="apply-eq-btn"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/20"
          >
            Done & Apply
          </button>
        </div>
      </div>
    </div>
  );
}

