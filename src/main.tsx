import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import PlatformRoot from './PlatformRoot.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformRoot />
  </StrictMode>,
);
