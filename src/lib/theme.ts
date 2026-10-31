export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Stored choice wins; otherwise follow the system preference; dark is the fallback.
 */
export const themeInitScript = `(function(){try{var d=document.documentElement;var s=localStorage.getItem("${THEME_STORAGE_KEY}");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");d.dataset.theme=t;d.dataset.js="1";}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.dataset.js="1";}})();`;
