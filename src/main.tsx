import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { NRNMusicLauncher } from './components/NRNMusicLauncher';
import { PIOSIntentLauncher } from './components/PIOSIntentLauncher';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <NRNMusicLauncher />
    <PIOSIntentLauncher />
  </React.StrictMode>
);
