'use strict';
(() => {
 const system = window.matchMedia('(prefers-color-scheme: dark)');
 let preference = 'auto';
 try {
  const stored = localStorage.getItem('rodloom-theme');
  if (['auto', 'light', 'dark'].includes(stored)) preference = stored;
 } catch {}
 function apply() {
  document.documentElement.dataset.theme = preference === 'auto' ? (system.matches ? 'dark' : 'light') : preference;
  window.dispatchEvent(new Event('themechange'));
 }
 apply();
 system.addEventListener('change', () => { if (preference === 'auto') apply(); });
 document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('theme-mode');
  select.value = preference;
  select.addEventListener('change', () => {
   preference = select.value;
   try { localStorage.setItem('rodloom-theme', preference); } catch {}
   apply();
  });
 });
})();
