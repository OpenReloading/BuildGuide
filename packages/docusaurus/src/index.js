// Docusaurus plugin: validates the guide data against the schema and checks it at build time, serves core at <baseUrl>assets/buildguide/ and
// provides <BuildGuide view="bom"/>, <BuildGuide view="board" board="KEY"/> and <BuildGuide view="guide"/> as @theme/BuildGuide. Core is copied into ../core/ by scripts/copy-core.mjs.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Ajv = require('ajv/dist/2020');

const CORE = path.join(__dirname, '..', 'core');
// one line per schema error: the path of the key (a surplus or missing key named at its end), then what is wrong
const schemaProblem = (e) => {
  const key = e.params.additionalProperty ?? e.params.missingProperty;
  return `${e.instancePath}${key === undefined ? '' : `/${key}`}: ${e.message}`;
};
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
      let guide;
      try { guide = JSON.parse(readFileSync(data, 'utf8')); } catch (error) { throw new Error(`${options.data}: ${error.message}`); }
      const validate = new Ajv({ allErrors: true, allowUnionTypes: true }).compile(JSON.parse(readFileSync(path.join(CORE, 'buildguide.schema.json'), 'utf8')));
      // before the check: it reads the data as the schema describes it
      if (!validate(guide)) throw new Error(`${options.data}:\n${validate.errors.map(schemaProblem).join('\n')}`);
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
