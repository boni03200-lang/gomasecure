import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { shouldSuppressError } from './utils/error';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root not found');

// GLOBAL ERROR SUPPRESSION
// This catches "signal is aborted without reason" errors from Supabase/Fetch which are harmless
// cancellation noises.
window.addEventListener('unhandledrejection', (event) => {
  if (shouldSuppressError(event.reason)) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (shouldSuppressError(event.error) || shouldSuppressError(event.message)) {
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
