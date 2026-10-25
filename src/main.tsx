import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdvancedDeviceActionsWindow from './components/AdvancedDeviceActionsWindow';
import './index.css';

const view = new URLSearchParams(window.location.search).get('view');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {view === 'advanced-device-actions' ? <AdvancedDeviceActionsWindow /> : <App />}
  </StrictMode>
);
