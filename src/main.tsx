import React from 'react';
import ReactDOM from 'react-dom/client';
const App = React.lazy(() => import('./App'));
const backendConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
import { ErrorBoundary } from './components/ErrorBoundary';
import { NRNMusicLauncher } from './components/NRNMusicLauncher';
import { registerSistrumPWA } from './pwa';
import './index.css';

registerSistrumPWA();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>{backendConfigured ? <React.Suspense fallback={<p role="status">Connecting to Sistrum…</p>}><App /></React.Suspense> : <main role="alert" className="min-h-screen bg-neutral-950 p-10 text-white"><h1>Sistrum is being configured</h1><p>Account and catalog services are not available yet. Please try again later.</p></main>}</ErrorBoundary>
    <NRNMusicLauncher />
  </React.StrictMode>
);
