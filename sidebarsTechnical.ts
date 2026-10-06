import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// Reference navigation groups transaction contracts together, then follows
// the protocol's contract boundaries. Each category opens on a hub.
const contract = (dir: string, label: string, items: string[]) => ({
  type: 'category' as const,
  label,
  collapsed: true,
  link: { type: 'doc' as const, id: `${dir}/overview` },
  items: items.map((page) => `${dir}/${page}`),
});

const sidebars: SidebarsConfig = {
  technicalSidebar: [
    'index',
    'units',
    {
      type: 'category',
      label: 'Transactions and authorization',
      collapsed: true,
      link: { type: 'doc', id: 'router/overview' },
      items: ['router/batching', 'router/fee-abstraction', 'session-policy', 'wallet-factory'],
    },
    contract('market', 'Market', [
      'dependencies',
      'config',
      'status',
      'pricing',
      'orders',
      'position-lifecycle',
      'margin-and-leverage',
      'pnl-calculation',
      'fee-system',
      'funding-rate',
      'borrowing-rate',
      'liquidation',
      'auto-deleveraging',
      'vault-orders',
      'storage',
      'events',
      'errors',
    ]),
    contract('vault', 'Vault', ['share-token', 'share-pricing', 'strategy-withdraw']),
    contract('oracle', 'Oracle', ['verify-price', 'settings']),
    contract('factory', 'Factory', ['deploy', 'init-meta']),
    contract('treasury', 'Treasury', ['fee-rate']),
    contract('governance', 'Governance', ['timelock', 'delay']),
  ],
};

export default sidebars;
