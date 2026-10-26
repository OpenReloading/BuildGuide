// Docusaurus plugin: validates the guide data against the schema and checks it at build time, serves core and the data (guide.json, more guides in guides/<id>.json)
// at <baseUrl>assets/buildguide/ and provides <BuildGuide view="bom"/>, <BuildGuide view="board" board="KEY"/>, <BuildGuide view="guide"/> and <BuildGuide guide="ID" .../> as @theme/BuildGuide. Core is copied into ../core/ by scripts/copy-core.mjs.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Ajv = require('ajv/dist/2020');

const CORE = path.join(__dirname, '..', 'core');
// one line per schema error: the path of the key (a surplus or missing key named at its end), then what is wrong
const schemaProblem = (e) => {
  const key = e.params.additionalProperty ?? e.params.missingProperty;
  return `${e.instancePath}${key === undefined ? '' : `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`}: ${e.message}`;
};

module.exports = function buildguide(context, options = {}) {
  if (!options.data) throw new Error('buildguide: the option data (path to the guide JSON) is missing');
  const data = path.resolve(context.siteDir, options.data);
  const named = Object.entries(options.guides ?? {}).map(([id, file]) => {
    // the id is a file name and a URL segment
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`buildguide: the guides id ${JSON.stringify(id)} may only hold letters, digits, - and _`);
    return { id, file, path: path.resolve(context.siteDir, file) };
  });
  const core = `${context.baseUrl}assets/buildguide/`;
  let guide; // the validated data, written to guide.json by the copy below
  const guides = {}; // the validated data of each named guide, written to guides/<id>.json
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
    getPathsToWatch: () => [data, ...named.map((g) => g.path)],
    async loadContent() {
      const validate = new Ajv({ allErrors: true, allowUnionTypes: true }).compile(JSON.parse(readFileSync(path.join(CORE, 'buildguide.schema.json'), 'utf8')));
      const { check } = await import(pathToFileURL(path.join(CORE, 'buildguide-check.mjs')).href);
      const load = (file, name) => {
        let loaded;
        try { loaded = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { throw new Error(`${name}: ${error.message}`); }
        // before the check: it reads the data as the schema describes it
        if (!validate(loaded)) throw new Error(`${name}:\n${validate.errors.map(schemaProblem).join('\n')}`);
        const problems = check(loaded);
        if (problems.length) throw new Error(`${name}:\n${problems.join('\n')}`);
        return loaded;
      };
      guide = load(data, options.data);
      const owners = new Map([[guide.storage, 'data']]);
      for (const g of named) {
        guides[g.id] = load(g.path, g.file);
        // localStorage is per origin: guides with the same key tick each other's connections
        const { storage } = guides[g.id];
        if (owners.has(storage)) throw new Error(`${owners.get(storage)} and guides.${g.id} have the same storage key ${JSON.stringify(storage)}: each guide on a site needs its own`);
        owners.set(storage, `guides.${g.id}`);
      }
      return guide;
    },
    // the theme component reads the URLs from here; the data is the file guide.json, so the pages carry none of it.
    // The name differs from core's own #guide-data, so core does not mount by itself when it loads
    injectHtmlTags() {
      return {
        headTags: [
          { tagName: 'link', attributes: { rel: 'stylesheet', href: `${core}buildguide.css` } },
          { tagName: 'meta', attributes: { name: 'buildguide', 'data-core': core, 'data-assets': assets, 'data-src': `${core}guide.json` } },
        ],
      };
    },
    configureWebpack(config, isServer, { currentBundler }) {
      if (isServer) return {};
      const Copy = currentBundler.name === 'rspack' ? currentBundler.instance.CopyRspackPlugin : require('copy-webpack-plugin');
      // minimized: the vendored files ship unmodified
      return {
        plugins: [new Copy({ patterns: [
          { from: CORE, to: 'assets/buildguide', info: { minimized: true } },
          // `from` makes the build watch the data file; the content is the validated data without its whitespace
          { from: data, to: 'assets/buildguide/guide.json', transform: () => JSON.stringify(guide) },
          ...named.map((g) => ({ from: g.path, to: `assets/buildguide/guides/${g.id}.json`, transform: () => JSON.stringify(guides[g.id]) })),
        ] })],
      };
    },
  };
};
