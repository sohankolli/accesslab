// main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';
import { store } from './app/store';
import { router } from './app/router';
import { SettingsProvider } from './context/SettingsContext';
import './styles/tokens.css';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <SettingsProvider>
        <RouterProvider router={router} />
      </SettingsProvider>
    </Provider>
  </StrictMode>,
);
