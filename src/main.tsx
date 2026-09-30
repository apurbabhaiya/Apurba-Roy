import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import RouterApp from './RouterApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterApp />
  </StrictMode>,
);
