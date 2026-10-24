// main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import './styles/tokens.css';
import './styles/global.css';

// The Redux <Provider> and <SettingsProvider> from Listing 19 wrap this in item 6,
// when the store and the settings context exist.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
