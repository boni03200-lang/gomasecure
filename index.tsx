import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root not found');

// GLOBAL ERROR SUPPRESSION FOR ABORT ERRORS
// This catches "signal is aborted without reason" errors from Supabase/Fetch
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (
    event.reason?.name === 'AbortError' || 
    msg.includes('aborted') || 
    msg.includes('signal is aborted')
  ) {
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);