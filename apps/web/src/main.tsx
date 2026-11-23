import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyDocumentLanguage } from './i18n';
import { config } from './config';
import './styles/index.css';

applyDocumentLanguage();

// CardCom's 3D Secure helper: on 3DS terminals the master frame asks this page to run the device
// fingerprint and the cardholder challenge (StartDeviceFingerPrint / CardHolderChallenge). It finds the
// master iframe by id="CardComMasterFrame". Loaded once, from the same CardCom host as the iframes.
const threeDSecureScript = document.createElement('script');
threeDSecureScript.src = `${config.cardcomHost}/External/OpenFields/3DS.js`;
document.head.appendChild(threeDSecureScript);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
