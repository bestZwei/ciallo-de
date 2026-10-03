import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SELF_CHECK } from './lib/devflag';
import './styles/tokens.css';
import './styles/base.css';

const domNode = document.getElementById('root');
if (!domNode) {
  throw new Error('Root element #root not found');
}

createRoot(domNode).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

/* Loaded only with ?selfcheck, so the probe never ships into the normal path's graph
   at runtime and never touches the pools when the flag is off. */
if (SELF_CHECK) {
  import('./dev/selfCheck')
    .then((m) => m.runSelfCheck())
    .catch((err: unknown) => {
      const crash = document.createElement('pre');
      crash.textContent = `self-check crashed: ${err instanceof Error ? err.stack : String(err)}`;
      document.body.append(crash);
    });
}
