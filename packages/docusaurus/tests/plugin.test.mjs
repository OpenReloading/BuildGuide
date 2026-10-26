import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import buildguide from '../src/index.js';

const example = new URL('../../core/example/guide.json', import.meta.url).pathname;
const site = (data, options = {}) => buildguide({ siteDir: '/', baseUrl: '/docs/' }, { data, ...options });

const meta = (options) => site(example, options).injectHtmlTags().headTags[1].attributes;

test('loads and checks the data', async () => {
  const guide = await site(example).loadContent();
  assert.deepEqual(guide, JSON.parse(readFileSync(example, 'utf8')));
});

test('the pages carry the stylesheet link and the URLs, none of the data', () => {
  assert.deepEqual(site(example, { assets: '/media' }).injectHtmlTags().headTags, [
    { tagName: 'link', attributes: { rel: 'stylesheet', href: '/docs/assets/buildguide/buildguide.css' } },
    { tagName: 'meta', attributes: { name: 'buildguide', 'data-core': '/docs/assets/buildguide/', 'data-assets': '/docs/media/', 'data-src': '/docs/assets/buildguide/guide.json' } },
  ]);
});

test('guide.json is the validated data, minified, written next to core', async () => {
  const plugin = site(example);
  const guide = await plugin.loadContent();
  const { plugins } = plugin.configureWebpack({}, false, { currentBundler: { name: 'webpack' } });
  const [, data] = plugins[0].patterns;
  assert.equal(data.to, 'assets/buildguide/guide.json');
  assert.equal(data.from, example);
  assert.equal(data.transform(), JSON.stringify(guide));
  assert.deepEqual(plugin.configureWebpack({}, true, {}), {});
});

test('assets is a folder below baseUrl', () => {
  const url = (assets) => meta(assets === undefined ? {} : { assets })['data-assets'];
  assert.deepEqual([undefined, '/', '', '/media', 'media/', 'a/b'].map(url), ['/docs/assets/', '/docs/', '/docs/', '/docs/media/', '/docs/media/', '/docs/a/b/']);
});

test('assets with very many slashes is trimmed in linear time', () => {
  const start = performance.now();
  const inner = '/'.repeat(100000);
  assert.equal(meta({ assets: `//a${inner}x//` })['data-assets'], `/docs/a${inner}x/`);
  assert.ok(performance.now() - start < 500);
});

test('problems in the data stop the build, one line each', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../../core/tests/fixtures/board-ids.json', import.meta.url)));
  const file = join(mkdtempSync(join(tmpdir(), 'bg-')), 'guide.json');
  writeFileSync(file, JSON.stringify(fixture.guide));
  await assert.rejects(site(file).loadContent(), { message: `${file}:\n${fixture.problems.join('\n')}` });
});

const guideFile = (guide) => {
  const file = join(mkdtempSync(join(tmpdir(), 'bg-')), 'guide.json');
  writeFileSync(file, typeof guide === 'string' ? guide : JSON.stringify(guide));
  return file;
};

test('a misspelt key or a wrong type fails the build with the file and the key', async () => {
  const guide = JSON.parse(readFileSync(example, 'utf8'));
  guide.bom.items[0].quantity = 1;
  guide.boards.wiring.steps[0].note = 1;
  const file = guideFile(guide);
  await assert.rejects(site(file).loadContent(), (error) => {
    assert.ok(error.message.startsWith(`${file}:\n`), error.message);
    assert.match(error.message, /^\/bom\/items\/0\/quantity: /m);
    assert.match(error.message, /^\/boards\/wiring\/steps\/0\/note: must be string,object$/m);
    return true;
  });
});

test('a surplus key with a slash is escaped as in a JSON pointer', async () => {
  const guide = JSON.parse(readFileSync(example, 'utf8'));
  guide['a/b~c'] = 1;
  await assert.rejects(site(guideFile(guide)).loadContent(), /^\/a~1b~0c: must NOT have additional properties$/m);
});

test('a missing key is named with its path', async () => {
  const guide = JSON.parse(readFileSync(example, 'utf8'));
  delete guide.storage;
  delete guide.boards.tubing.title;
  await assert.rejects(site(guideFile(guide)).loadContent(), (error) => {
    assert.match(error.message, /^\/storage: must have required property 'storage'$/m);
    assert.match(error.message, /^\/boards\/tubing\/title: must have required property 'title'$/m);
    return true;
  });
});

test('data of the wrong shape is a schema problem, not a TypeError', async () => {
  const guide = JSON.parse(readFileSync(example, 'utf8'));
  guide.boards.wiring.steps = { not: 'a list' };
  await assert.rejects(site(guideFile(guide)).loadContent(), /^Error: .*guide\.json:\n\/boards\/wiring\/steps: must be array$/m);
});

test('a file that is not JSON fails the build with the file name', async () => {
  const file = guideFile('{"storage": ');
  await assert.rejects(site(file).loadContent(), (error) => error.message.startsWith(`${file}: `));
});

test('the data option is required', () => {
  assert.throws(() => site(undefined), /option data/);
});
