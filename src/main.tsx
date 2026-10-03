import React from 'react';
import ReactDOM from 'react-dom/client';
const App = React.lazy(() => import('./App'));
import { isSupabaseConfigured } from './lib/supabase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NRNMusicLauncher } from './components/NRNMusicLauncher';
import { registerSistrumPWA } from './pwa';
import './index.css';

registerSistrumPWA();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {!isSupabaseConfigured && (
        <p role="status" className="bg-amber-950 text-amber-100 px-4 py-2 text-sm">
          Catalog and accounts are offline until VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set on Vercel. Spotify and NRN tools still load.
        </p>
      )}
      <React.Suspense fallback={<p role="status">Connecting to Sistrum…</p>}>
        <App />
      </React.Suspense>
    </ErrorBoundary>
    <NRNMusicLauncher />
  </React.StrictMode>
);
