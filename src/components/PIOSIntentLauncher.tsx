import { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import { PIOSIntentView } from './PIOSIntentView';

export const PIOS_OPEN_EVENT = 'sistrum:open-pios';

export function PIOSIntentLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openPIOS = () => setIsOpen(true);
    window.addEventListener(PIOS_OPEN_EVENT, openPIOS);
    return () => window.removeEventListener(PIOS_OPEN_EVENT, openPIOS);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 right-5 z-40 flex items-center gap-2 rounded-2xl border border-[#ff5500]/30 bg-[#111118]/95 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#ff7a45] shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-[#ff5500]/60 hover:text-white"
        aria-label="Open PIOS Intent Layer"
        title="Open PIOS Intent Layer"
      >
        <Activity className="h-4 w-4" />
        PIOS
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#08080c]/95 backdrop-blur-xl">
          <div className="sticky top-0 z-10 border-b border-neutral-800 bg-[#0f0f14]/95 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#ff5500]" />
                <span className="text-sm font-black tracking-tight text-white">SISTRUM · PIOS</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-neutral-800 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white"
                aria-label="Close PIOS"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <main className="mx-auto w-full max-w-7xl px-4 pt-6">
            <PIOSIntentView />
          </main>
        </div>
      )}
    </>
  );
}
