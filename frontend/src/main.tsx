import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* Import Design System Foundation in strict order */
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
