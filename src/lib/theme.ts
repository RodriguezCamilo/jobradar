// Runs before paint, outside React hydration; no theme dependency required.
export const THEME_BOOT_SCRIPT = `(function(){var t='dark';try{if(localStorage.getItem('job-radar-theme')==='light')t='light'}catch(e){}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;
