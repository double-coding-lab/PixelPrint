import * as React from 'react';
import { createRoot } from 'react-dom/client';
import styles from './styles.css';
import { App } from './App';

// 注入样式(esbuild 通过 loader:text 引入)
const styleEl = document.createElement('style');
styleEl.textContent = styles;
document.head.appendChild(styleEl);

const container = document.getElementById('root');
if (!container) throw new Error('root container missing');
const root = createRoot(container);
root.render(<App />);
