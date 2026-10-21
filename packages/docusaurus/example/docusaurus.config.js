// Example site: the core example guide under /example/, as in the MkDocs docs site, for the core browser tests.
module.exports = {
  title: 'BuildGuide example',
  url: 'https://openreloading.github.io',
  baseUrl: '/',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  plugins: [[require.resolve('..'), { data: '../../core/example/guide.json', site: '/example/' }]],
  themeConfig: {
    navbar: {
      title: 'BuildGuide example',
      items: ['Introduction', 'BOM', 'Wiring', 'Tubing'].map((label, i) => ({ label, to: `/example/${['', 'bom/', 'wiring/', 'tubing/'][i]}` })),
    },
  },
  presets: [['classic', { docs: { path: 'docs', routeBasePath: 'example', sidebarPath: false }, blog: false }]],
};
