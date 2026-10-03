import type { LegalDocument } from '../types';

export function AppFooter({ onOpen }: { onOpen: (document: LegalDocument) => void }) {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 px-4 py-8 pb-28 text-center text-xs text-neutral-500">
      <p className="mb-3">Sistrum private beta · An NRN / SEYDANIC project</p>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Legal">
        <button onClick={() => onOpen('terms')} className="hover:text-white">Terms</button>
        <button onClick={() => onOpen('privacy')} className="hover:text-white">Privacy</button>
        <button onClick={() => onOpen('community')} className="hover:text-white">Community Guidelines</button>
        <button onClick={() => onOpen('copyright')} className="hover:text-white">Copyright</button>
      </nav>
    </footer>
  );
}
