import { createRoot } from 'react-dom/client';
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from './App.tsx';
import './index.css';
import { convex } from './convexClient';
import { installPopstateInterceptor } from './lib/navigationGuard';

// Must precede BrowserRouter's popstate listener so unsaved-change guards can stop browser back/forward.
installPopstateInterceptor();

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>
);
