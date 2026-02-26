import { createRoot } from 'react-dom/client';
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from './App.tsx';
import './index.css';
import { convex } from './convexClient';

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>
);
