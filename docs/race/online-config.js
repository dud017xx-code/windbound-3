// Existing free Pages service entrance; the Cloudflare website package serves its API on the same origin.
window.WINDBOUND_ROOM_SERVICE = location.hostname.endsWith('.pages.dev') ? location.origin : 'https://windbound-free-entry.pages.dev';
