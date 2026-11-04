// Docusaurus plugin: validates the guide data against the schema and checks it at build time, serves core and the data (guide.json, more guides in guides/<id>.json)
// at <baseUrl>assets/buildguide/ and provides <BuildGuide view="bom"/>, <BuildGuide view="steps"/>, <BuildGuide view="board" board="KEY"/>, <BuildGuide view="guide"/> and <BuildGuide guide="ID" .../> as @theme/BuildGuide. Core is copied into ../core/ by scripts/copy-core.mjs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LoadContext, Plugin } from '@docusaurus/types';
import Ajv, { type ErrorObject } from 'ajv/dist/2020';
import type CopyPlugin from 'copy-webpack-plugin';

// core's declarations, copied with core into ../core/ (scripts/copy-core.mjs)
type Guide = import('../core/buildguide-check.mjs').Guide;
type Check = typeof import('../core/buildguide-check.mjs');
/** The plugin options: `data` is the guide of the site, `guides` more guides by id, `assets` the folder of BOM images below baseUrl. */
interface Options { data: string; guides?: Record<string, string>; assets?: string }

const CORE = path.join(__dirname, '..', 'core');
// one line per schema error: the path of the key (a surplus or missing key named at its end), then what is wrong
const schemaProblem = (e: ErrorObject) => {
  const key: unknown = e.params.additionalProperty ?? e.params.missingProperty;
  return `${e.instancePath}${key === undefined ? '' : `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`}: ${e.message}`;
};

function buildguide(context: Pick<LoadContext, 'siteDir' | 'baseUrl'>, options: Partial<Options> = {}): Plugin<Guide> {
  if (!options.data) throw new Error('buildguide: the option data (path to the guide JSON) is missing');
  const data = path.resolve(context.siteDir, options.data);
  const named = Object.entries(options.guides ?? {}).map(([id, file]) => {
    // the id is a file name and a URL segment
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`buildguide: the guides id ${JSON.stringify(id)} may only hold letters, digits, - and _`);
    return { id, file, path: path.resolve(context.siteDir, file) };
  });
  const core = `${context.baseUrl}assets/buildguide/`;
  let guide: Guide | undefined; // the validated data, written to guide.json by the copy below
  const guides: Record<string, Guide> = {}; // the validated data of each named guide, written to guides/<id>.json
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
      const validate = new Ajv({ allErrors: true, allowUnionTypes: true }).compile<Guide>(JSON.parse(readFileSync(path.join(CORE, 'buildguide.schema.json'), 'utf8')));
      const { check } = (await import(pathToFileURL(path.join(CORE, 'buildguide-check.mjs')).href)) as Check;
      const load = (file: string, name: string) => {
        let loaded: unknown;
        try { loaded = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { throw new Error(`${name}: ${(error as Error).message}`); }
        // before the check: it reads the data as the schema describes it
        if (!validate(loaded)) throw new Error(`${name}:\n${(validate.errors ?? []).map(schemaProblem).join('\n')}`);
        const problems = check(loaded);
        if (problems.length) throw new Error(`${name}:\n${problems.join('\n')}`);
        return loaded;
      };
      const loaded = load(data, options.data as string);
      guide = loaded;
      const owners = new Map([[loaded.storage, 'data']]);
      for (const g of named) {
        const other = load(g.path, g.file), { storage } = other;
        guides[g.id] = other;
        // localStorage is per origin: guides with the same key tick each other's connections
        if (owners.has(storage)) throw new Error(`${owners.get(storage)} and guides.${g.id} have the same storage key ${JSON.stringify(storage)}: each guide on a site needs its own`);
        owners.set(storage, `guides.${g.id}`);
      }
      return loaded;
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
    configureWebpack(_config, isServer, { currentBundler }) {
      if (isServer) return {};
      // required here, not imported: an rspack build never loads it. Docusaurus types the instance as webpack's, rspack brings its own copy plugin
      const Copy: typeof CopyPlugin = currentBundler.name === 'rspack' ? (currentBundler.instance as unknown as { CopyRspackPlugin: typeof CopyPlugin }).CopyRspackPlugin : require('copy-webpack-plugin');
      // minimized: the vendored files ship unmodified; the declarations and the check's source map are for Node, not the page.
      // context: webpack matches the ignore patterns from it (by default the build's working directory, which need not hold core/); rspack matches them against absolute paths
      return {
        plugins: [new Copy({ patterns: [
          { from: CORE, context: CORE, to: 'assets/buildguide', info: { minimized: true }, globOptions: { ignore: ['**/*.d.ts', '**/*.d.mts', '**/*.map'] } },
          // `from` makes the build watch the data file; the content is the validated data without its whitespace
          { from: data, to: 'assets/buildguide/guide.json', transform: () => JSON.stringify(guide) },
          ...named.map((g) => ({ from: g.path, to: `assets/buildguide/guides/${g.id}.json`, transform: () => JSON.stringify(guides[g.id]) })),
        ] })],
      };
    },
  };
}
export = buildguide;
