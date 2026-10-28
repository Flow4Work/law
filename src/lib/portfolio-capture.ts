/** Repeatable local capture using the shipped example and the real application UI. */
export function isPortfolioCapture():boolean {
 return typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('capture')==='portfolio';
}
