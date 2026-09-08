import { useEffect, useState } from 'react';
import { Music2, X } from 'lucide-react';
import { NRNMusicView } from './NRNMusicView';

export function NRNMusicLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full border border-[#ff5500]/40 bg-[#ff5500] px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-2xl shadow-[#ff5500]/20 transition hover:scale-[1.03]"
        title="Open NRN Music (Ctrl/Cmd + Shift + M)"
      >
        <Music2 className="h-4 w-4" />
        NRN Music
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#08080b]/98 backdrop-blur-xl">
          <div className="sticky top-0 z-10 border-b border-neutral-800 bg-[#08080b]/90 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff5500] text-white"><Music2 className="h-5 w-5" /></div>
                <div><div className="text-sm font-black tracking-tight text-white">NRN MUSIC</div><div className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-500">Unified music infrastructure</div></div>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-900 text-neutral-400 hover:text-white" aria-label="Close NRN Music"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 pt-6"><NRNMusicView /></div>
        </div>
      )}
    </>
  );
}
