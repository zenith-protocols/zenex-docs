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

  clientModules: ['./src/clientModules/copyButtonNudge.ts'],

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
        // Index the visible docs plugin instances. The default instance is
        // served at the site root. Integrations is temporarily hidden from
        // the navbar, so keep it out of the search index too.
        docsRouteBasePath: ['/', 'technical'],
        docsDir: ['docs', 'technical'],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        hashed: true,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        language: ['en'],
        removeDefaultStopWordFilter: true,
        searchBarPosition: 'left',
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
      // Copy page as Markdown + open in Claude/ChatGPT/Perplexity/Gemini,
      // pinned to the TOC rail. generateMarkdownRoutes emits a .md twin
      // next to every built page for clean AI ingestion.
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
        // Integrations is temporarily hidden while its docs catch up to v2.
        // The plugin still builds the pages, so direct /integrations URLs
        // keep working. Restore this item (and the search-local entries
        // above) to bring it back.
        // {
        //   type: 'docSidebar',
        //   sidebarId: 'integrationsSidebar',
        //   docsPluginId: 'integrations',
        //   position: 'left',
        //   label: 'Integrations',
        // },
        {
          type: 'html',
          position: 'right',
          value:
            '<a href="https://github.com/zenith-protocols" target="_blank" rel="noopener noreferrer" class="navbar-social" aria-label="GitHub"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg></a>',
        },
        {
          type: 'html',
          position: 'right',
          value:
            '<a href="https://x.com/zenithprotocols" target="_blank" rel="noopener noreferrer" class="navbar-social" aria-label="X (Twitter)"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z"/></svg></a>',
        },
        {
          type: 'html',
          position: 'right',
          value:
            '<a href="https://discord.gg/zenex" target="_blank" rel="noopener noreferrer" class="navbar-social" aria-label="Discord"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 0 0-5.48 0 12.6 12.6 0 0 0-.62-1.26.07.07 0 0 0-.08-.04c-1.71.3-3.35.81-4.88 1.52a.06.06 0 0 0-.03.02C.53 9.05-.32 13.58.1 18.06c0 .02.01.04.03.05a19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1-.01-.12c.13-.1.25-.19.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.25.2.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99.02.03.05.04.08.03a19.8 19.8 0 0 0 6.02-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z"/></svg></a>',
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['rust', 'toml'], // Added for Soroban development
    },
  } satisfies Preset.ThemeConfig,
};

export default config;