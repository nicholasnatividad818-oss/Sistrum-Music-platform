import { useEffect, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import App from './App';
import { DramaExperience } from './components/DramaExperience';

const isDramaRoute = () => window.location.hash === '#dramas';

export default function PlatformRoot() {
  const [showDramas, setShowDramas] = useState(isDramaRoute);

  useEffect(() => {
    const onHashChange = () => setShowDramas(isDramaRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (showDramas) {
    return <DramaExperience />;
  }

  return (
    <>
      <App />
      <button
        onClick={() => { window.location.hash = 'dramas'; }}
        className="fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-2xl border border-[#ff6a2a]/30 bg-[#161018]/95 px-4 py-3 text-xs font-black text-white shadow-2xl shadow-black/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#ff6a2a]/60 hover:bg-[#20131a]"
        aria-label="Open NRN Short Dramas"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff5500]">
          <Clapperboard className="h-4 w-4" />
        </span>
        NRN Dramas
      </button>
    </>
  );
}
