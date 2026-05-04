/**
 * Vercel Speed Insights initialization for vanilla JS/HTML projects
 * This module injects the Speed Insights tracking script when deployed on Vercel
 */

export function injectSpeedInsights() {
  // Only inject if running on Vercel (VERCEL_ENV will be set in production)
  if (typeof window === 'undefined') {
    return;
  }

  // Initialize the Speed Insights queue
  window.si = window.si || function () {
    (window.siq = window.siq || []).push(arguments);
  };

  // Create and inject the script tag
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  
  // Append to document head
  document.head.appendChild(script);
}
