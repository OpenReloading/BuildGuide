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

const minimal = new URL('../../core/example/minimal/all.json', import.meta.url).pathname;
const bom = new URL('../../core/example/minimal/bom.json', import.meta.url).pathname;
const withStorage = (storage) => guideFile({ ...JSON.parse(readFileSync(minimal, 'utf8')), storage });

test('guides: every guide is loaded, watched and written to guides/<id>.json, minified, next to guide.json', async () => {
  const plugin = site(example, { guides: { minimal, other_2: bom } });
  const guide = await plugin.loadContent();
  assert.deepEqual(guide, JSON.parse(readFileSync(example, 'utf8')));
  assert.deepEqual(plugin.getPathsToWatch(), [example, minimal, bom]);
  const { plugins } = plugin.configureWebpack({}, false, { currentBundler: { name: 'webpack' } });
  const [, data, ...guides] = plugins[0].patterns;
  assert.equal(data.to, 'assets/buildguide/guide.json');
  assert.deepEqual(guides.map((g) => [g.from, g.to]), [[minimal, 'assets/buildguide/guides/minimal.json'], [bom, 'assets/buildguide/guides/other_2.json']]);
  assert.equal(guides[0].transform(), JSON.stringify(JSON.parse(readFileSync(minimal, 'utf8'))));
});

test('guides: the head tags are the same, a component builds the URL of a guide from data-core', () => {
  assert.deepEqual(site(example, { guides: { minimal } }).injectHtmlTags(), site(example).injectHtmlTags());
});

test('without guides the build writes guide.json only', () => {
  const { plugins } = site(example).configureWebpack({}, false, { currentBundler: { name: 'webpack' } });
  assert.equal(plugins[0].patterns.length, 2);
});

test('guides: a problem in a named guide stops the build and names its file', async () => {
  const file = guideFile({ ...JSON.parse(readFileSync(minimal, 'utf8')), extra: 1 });
  await assert.rejects(site(example, { guides: { bad: file } }).loadContent(), { message: `${file}:\n/extra: must NOT have additional properties` });
  const broken = guideFile('{"storage": ');
  await assert.rejects(site(example, { guides: { bad: broken } }).loadContent(), (error) => error.message.startsWith(`${broken}: `));
});

test('guides: the cross-reference check runs on a named guide', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../../core/tests/fixtures/board-ids.json', import.meta.url)));
  const file = guideFile(fixture.guide);
  await assert.rejects(site(example, { guides: { bad: file } }).loadContent(), { message: `${file}:\n${fixture.problems.join('\n')}` });
});

test('guides: the same storage key as data, or as another guide, fails the build', async () => {
  const storage = JSON.parse(readFileSync(example, 'utf8')).storage;
  await assert.rejects(site(example, { guides: { second: withStorage(storage) } }).loadContent(), { message: `data and guides.second have the same storage key "${storage}": each guide on a site needs its own` });
  const [a, b] = [withStorage('same'), withStorage('same')];
  await assert.rejects(site(example, { guides: { a, b } }).loadContent(), /^Error: guides\.a and guides\.b have the same storage key "same"/);
  await site(example, { guides: { a, b: withStorage('other') } }).loadContent();
});

test('guides: an id is a file name and a URL segment', () => {
  for (const id of ['../x', 'a/b', 'a b', '', 'a.json']) assert.throws(() => site(example, { guides: { [id]: minimal } }), /guides id .* may only hold letters, digits, - and _/);
  site(example, { guides: { 'a-B_9': minimal } });
});
