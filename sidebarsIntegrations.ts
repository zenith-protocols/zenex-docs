import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  integrationsSidebar: [
    'overview',
    'quickstart',
    {
      type: 'category',
      label: 'Build an interface',
      collapsed: false,
      items: ['sdk', 'agent-wallet', 'relay', 'data-api'],
    },
    {
      type: 'category',
      label: 'Run your own services',
      collapsed: false,
      items: ['price-feed', 'indexing'],
    },
  ],
};

export default sidebars;
