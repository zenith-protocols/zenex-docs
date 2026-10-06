import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

let observer: MutationObserver | undefined;

/**
 * The search plugin gives the entire popup a listbox role, including its
 * footer link, and uses aria-owns rather than aria-controls on the input.
 * Put the listbox role on the options so the footer remains a normal link.
 */
function repairSearchRoles(): void {
  const input = document.querySelector<HTMLInputElement>(
    '.navbar__search-input[role="combobox"]',
  );
  const popup = input?.closest('.navbar__search')?.querySelector<HTMLElement>(
    '[class*="dropdownMenu_"]',
  );
  const options = popup?.querySelector<HTMLElement>('[class*="suggestions_"]');
  if (!input || !popup || !options) {
    return;
  }

  options.id = 'zenex-doc-search-results';
  options.setAttribute('role', 'listbox');
  options.setAttribute('aria-label', 'Search results');
  popup.removeAttribute('role');
  input.setAttribute('aria-controls', options.id);
  input.removeAttribute('aria-owns');
}

export function onRouteDidUpdate(): void {
  if (!ExecutionEnvironment.canUseDOM) {
    return;
  }
  repairSearchRoles();
  if (!observer) {
    observer = new MutationObserver(repairSearchRoles);
    observer.observe(document.body, {childList: true, subtree: true});
  }
}
