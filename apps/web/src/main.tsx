import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyDocumentLanguage } from './i18n';
import './styles/index.css';

applyDocumentLanguage();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
