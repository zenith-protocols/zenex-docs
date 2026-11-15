import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// Reader journeys first, then the decisions and risks behind each action.
// Existing doc IDs stay stable so previously shared page URLs keep working.
const section = (dir: string, label: string, items: string[]) => ({
  type: 'category' as const,
  label,
  collapsed: true,
  link: { type: 'doc' as const, id: `${dir}/overview` },
  items: items.map((page) => `${dir}/${page}`),
});

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Start here',
      collapsed: false,
      items: [
        'getting-started/what-is-zenex',
        'getting-started/start-trading',
        'getting-started/providing-liquidity',
      ],
    },
    section('account', 'Account and transactions', [
      'wallets-and-funds',
      'signing',
      'one-click-trading',
      'transactions',
    ]),
    section('trading', 'Trading', [
      'positions',
      'orders',
      'margin-and-leverage',
      'fees',
      'funding-rate',
      'borrowing-interest',
      'pnl',
      'claimable-credit',
      'liquidation',
      'adl',
    ]),
    section('vault', 'Liquidity and vaults', ['depositing', 'share-value']),
    {
      type: 'category',
      label: 'Markets and safety',
      link: { type: 'doc', id: 'markets/overview' },
      items: ['markets/prices', 'markets/status', 'markets/market-parameters', 'keepers', 'governance', 'risks'],
    },
    {
      type: 'category',
      label: 'Reference and help',
      items: ['deployments', 'audits', 'getting-started/glossary', 'faq', 'referrals'],
    },
  ],
};

export default sidebars;
