// Preview forms demonstrate submission without creating real enquiries or payments.
export const bookingDemo = /-ramyachobi\.vercel\.app$/.test(window.location.hostname) || ['localhost','127.0.0.1'].includes(window.location.hostname);
export const demoReference = () => 'DEMO-'+Date.now().toString(36).toUpperCase();
