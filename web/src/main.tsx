/* ============================================================
   Point d'entrée de la nouvelle application ProjectDesk (React + TypeScript)
   Servie sur /app/.
   ============================================================ */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './theme.css';

const racine = document.getElementById('racine');
if (!racine) throw new Error('Élément #racine introuvable dans index.html');

// basename = base de Vite (/app/ sans la barre finale) : les adresses de l'application sont relatives à /app
createRoot(racine).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
