// Docusaurus plugin: checks the guide data at build time, serves core at <baseUrl>assets/buildguide/ and
// provides <BuildGuide view="bom"/> and <BuildGuide view="board" board="KEY"/> as @theme/BuildGuide. Core is copied into ../core/ by scripts/copy-core.mjs.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CORE = path.join(__dirname, '..', 'core');
const attr = (value) => String(value).replace(/[&"<]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;' })[c]);

module.exports = function buildguide(context, options = {}) {
  if (!options.data) throw new Error('buildguide: the option data (path to the guide JSON) is missing');
  const data = path.resolve(context.siteDir, options.data);
  const core = `${context.baseUrl}assets/buildguide/`;
  // the folder of BOM images below baseUrl, as a URL path with one trailing slash
  const raw = options.assets ?? 'assets/';
  let from = 0, to = raw.length;
  while (raw[from] === '/') from++;
  while (to > from && raw[to - 1] === '/') to--;
  const below = raw.slice(from, to);
  const assets = context.baseUrl + (below && `${below}/`);
  return {
    name: 'docusaurus-plugin-buildguide',
    getThemePath: () => './theme',
    getClientModules: () => [path.join(__dirname, 'buildguide-docusaurus.css')],
    getPathsToWatch: () => [data],
    async loadContent() {
      const guide = JSON.parse(readFileSync(data, 'utf8'));
      const { check } = await import(pathToFileURL(path.join(CORE, 'buildguide-check.mjs')).href);
      const problems = check(guide);
      if (problems.length) throw new Error(`${options.data}:\n${problems.join('\n')}`);
      return guide;
    },
    // the theme component reads the data and the URLs from here. The id differs from core's own #guide-data,
    // so core does not mount by itself when it loads
    injectHtmlTags({ content }) {
      return {
        headTags: [
          { tagName: 'link', attributes: { rel: 'stylesheet', href: `${core}buildguide.css` } },
          `<script type="application/json" id="buildguide-data" data-core="${attr(core)}" data-assets="${attr(assets)}">${JSON.stringify(content).replace(/</g, '\\u003c')}</script>`,
        ],
      };
    },
    configureWebpack(config, isServer, { currentBundler }) {
      if (isServer) return {};
      const Copy = currentBundler.name === 'rspack' ? currentBundler.instance.CopyRspackPlugin : require('copy-webpack-plugin');
      // minimized: the vendored files ship unmodified
      return { plugins: [new Copy({ patterns: [{ from: CORE, to: 'assets/buildguide', info: { minimized: true } }] })] };
    },
  };
};
