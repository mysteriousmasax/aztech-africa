import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './newsletter.css';
import './brand.css';
import './structure.css';
import './topbar.css';
import './reader-flow.css';
import './lifecycle.css';
import './studio.css';
import './campaigns.css';
import './editorial-extras.css';
import './analytics.css';
import './header-motion.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
