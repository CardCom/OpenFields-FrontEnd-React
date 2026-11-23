import { PageShell } from './components/layout/PageShell';
import { CheckoutPage } from './components/checkout/CheckoutPage';
import { ResultPage } from './pages/ResultPage';

export function App() {
  const isResultPage = window.location.pathname.startsWith('/result');

  return <PageShell>{isResultPage ? <ResultPage /> : <CheckoutPage />}</PageShell>;
}
