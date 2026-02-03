
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root not found');

// GLOBAL ERROR SUPPRESSION
// This catches "signal is aborted without reason" errors from Supabase/Fetch which are harmless
// cancellation noises.
const shouldSuppress = (error: any) => {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    error?.name === 'AbortError' || 
    msg.includes('aborted') || 
    msg.includes('signal is aborted')
  );
};

window.addEventListener('unhandledrejection', (event) => {
  if (shouldSuppress(event.reason)) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (shouldSuppress(event.error) || shouldSuppress(event.message)) {
    event.preventDefault();
    event.stopPropagation();
  }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
