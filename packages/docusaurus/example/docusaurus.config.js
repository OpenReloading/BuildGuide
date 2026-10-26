// Example site: the core example guide's components under /example/, as in the MkDocs docs site, for the core browser tests.
module.exports = {
  title: 'BuildGuide example',
  url: 'https://openreloading.github.io',
  baseUrl: '/',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  plugins: [[require.resolve('..'), { data: '../../core/example/guide.json' }]],
  themeConfig: { navbar: { title: 'BuildGuide example' } },
  presets: [['classic', { docs: { path: 'docs', routeBasePath: 'example' }, blog: false, theme: { customCss: './src/css/custom.css' } }]],
};
