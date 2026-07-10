import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

/**
 * docusaurus-plugin-copy-page-button injects its button before React
 * hydration, and hydration can discard the injected container after the
 * plugin's observers have disconnected. The plugin repairs itself on
 * visibilitychange, so fire that hook once per route render.
 */
export function onRouteDidUpdate(): void {
  if (!ExecutionEnvironment.canUseDOM) {
    return;
  }
  window.setTimeout(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  }, 300);
}
