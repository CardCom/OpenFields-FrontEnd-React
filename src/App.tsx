import React, { useState, useRef, useEffect } from 'react';
import Summary from './components/Summary';
import CheckoutForm from './components/CheckoutForm';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

const App: React.FC = () => {
  // State management for the two-step checkout process
  const [step, setStep] = useState<'summary' | 'checkout'>('summary');
  // LowProfile code received from backend after creating LP deal
  const [lowProfileCode, setLowProfileCode] = useState<string>('');
  // Ref for loading spinner overlay
  const loadingRef = useRef<HTMLDivElement | null>(null);

  // This useEffect loads the Cardcom 3DS script dynamically for secure payment processing
  useEffect(() => {
    // Check if the script already exists in the document head (React.StrictMode may cause this to run twice)
    let scriptElement = document.head.querySelector<HTMLScriptElement>(`script[src*="/External/OpenFields/3DS.js"]`)
    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.src = `${import.meta.env.VITE_CARDCOM_URL}/External/OpenFields/3DS.js?v=${Date.now()}`;// Append a timestamp to avoid caching issues
      document.head.appendChild(scriptElement);
    }
    return () => {
      if (scriptElement && document.head.contains(scriptElement)) {
        document.head.removeChild(scriptElement);
      }
    };
  }, []);

  const handleContinue = async () => {
    try {
      // Call backend to create LowProfile deal and get LowProfileCode
      const res = await fetch(`${BACKEND_URL}/init`);
      const json = await res.json();
      setLowProfileCode(json.LowProfileId);
      setStep('checkout');
    } catch {
      alert('Could not create LP deal');
    }
  };

  return (
    <>
      {step === 'summary' && <Summary onContinue={handleContinue} />}
      {step === 'checkout' && (
        <CheckoutForm
          loadingRef={loadingRef}
          lowProfileCode={lowProfileCode}
        />
      )}
      <div ref={loadingRef} id="loading" style={{ display: 'none' }}>
        <div className="lds-spinner">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} />)}
        </div>
      </div>
    </>
  );
};

export default App;