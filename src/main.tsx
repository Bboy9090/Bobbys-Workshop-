import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark";

import App from './App.tsx';
import { ErrorFallback } from './ErrorFallback.tsx';
import { getAPIUrl } from './lib/apiConfig';

import "./main.css";
import "./styles/theme.css";
import "./index.css";

// Normalize relative API calls across the app.
// Many components call fetch('/api/...'); in Tauri (file:// origin) and in dev (Vite),
// this can hit the wrong server and return HTML -> "Unexpected token '<'".
// We rewrite only string URLs that start with "/api" to the configured backend base URL.
const __originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    return __originalFetch(getAPIUrl(input), init);
  }
  return __originalFetch(input as any, init);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

console.log('[main.tsx] Starting app render...');

try {
  createRoot(rootElement).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  );
  console.log('[main.tsx] App rendered successfully');
} catch (error) {
  console.error('[main.tsx] Render error:', error);
  // Show error in root element
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; font-family: monospace;">
      <h1>Render Error</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
      <pre>${error instanceof Error ? error.stack : ''}</pre>
    </div>
  `;
}
