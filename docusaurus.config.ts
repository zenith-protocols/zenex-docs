import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Zenex Documentation',
  tagline: 'Perpetuals Exchange on Soroban',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.zenex.trade',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'zenith-protocols', // Your GitHub org name
  projectName: 'zenex-docs', // Your repo name (adjust as needed)

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        // Index all three docs plugin instances. The default instance is
        // served at the site root, hence the empty-string route base.
        docsRouteBasePath: ['/', 'technical', 'integrations'],
        docsDir: ['docs', 'technical', 'integrations'],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        hashed: true,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        language: ['en'],
        removeDefaultStopWordFilter: true,
      },
    ],
  ],

  onBrokenLinks: 'warn',
  trailingSlash: false,

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // Serve docs at the site's root
          sidebarPath: './sidebars.ts',
          // Update this to your repo
          editUrl:
            'https://github.com/zenith-protocols/zenex-docs/tree/main/',
          // Add math support
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: false, // Disable the blog plugin
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'technical',
        path: 'technical',
        routeBasePath: 'technical',
        sidebarPath: './sidebarsTechnical.ts',
        editUrl:
          'https://github.com/zenith-protocols/zenex-docs/tree/main/',
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex],
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'integrations',
        path: 'integrations',
        routeBasePath: 'integrations',
        sidebarPath: './sidebarsIntegrations.ts',
        editUrl:
          'https://github.com/zenith-protocols/zenex-docs/tree/main/',
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex],
      },
    ],
    [
      // Copy page as Markdown + open in Claude/ChatGPT/Perplexity/Gemini.
      // One entry covers all three docs instances; generateMarkdownRoutes
      // emits a .md twin next to every built page for clean AI ingestion.
      'docusaurus-plugin-copy-page-button',
      {
        placement: 'toc',
        generateMarkdownRoutes: true,
      },
    ],
  ],

  // Add KaTeX stylesheet
  stylesheets: [
    {
      // Must match the installed katex version rehype-katex renders against
      href: 'https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-Wsr4Nh3yrvMf2KCebJchRJoVo1gTU6kcP05uRSh5NV3sj9+a8IomuJoQzf3sMq4T',
      crossorigin: 'anonymous',
    },
    {
      href: 'https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,900&display=swap',
      type: 'text/css',
    },
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/zenex-social-card.jpg',
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
      options: {
        themeVariables: {
          primaryColor: '#212225',
          primaryBorderColor: '#363a3f',
          primaryTextColor: '#edeef0',
          lineColor: '#696e77',
          fontFamily: 'Satoshi, sans-serif',
        },
      },
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Zenex',
      logo: {
        alt: 'Zenex Logo',
        src: 'img/favicon.ico',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          type: 'docSidebar',
          sidebarId: 'technicalSidebar',
          docsPluginId: 'technical',
          position: 'left',
          label: 'Technical',
        },
        {
          type: 'docSidebar',
          sidebarId: 'integrationsSidebar',
          docsPluginId: 'integrations',
          position: 'left',
          label: 'Integrations',
        },
        {
          href: 'https://github.com/zenith-protocols',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/zenex', // Update with your Discord link
            },
            {
              label: 'X (Twitter)',
              href: 'https://x.com/zenithprotocols', // Update with your X handle
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/zenith-protocols',
            },
            {
              label: 'Zenith Protocols',
              href: 'https://zenithprotocols.com', // Update with your website
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Zenith Protocols. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['rust', 'toml'], // Added for Soroban development
    },
  } satisfies Preset.ThemeConfig,
};

export default config;