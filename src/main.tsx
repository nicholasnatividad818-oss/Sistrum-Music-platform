import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { NRNMusicLauncher } from './components/NRNMusicLauncher';
import { registerSistrumPWA } from './pwa';
import './index.css';

registerSistrumPWA();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <NRNMusicLauncher />
  </React.StrictMode>
);
