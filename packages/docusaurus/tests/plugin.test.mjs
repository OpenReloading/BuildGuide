import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import buildguide from '../src/index.js';

const example = new URL('../../core/example/guide.json', import.meta.url).pathname;
const site = (data, options = {}) => buildguide({ siteDir: '/', baseUrl: '/docs/' }, { data, ...options });

test('loads and checks the data, injects it with the core URLs', async () => {
  const plugin = site(example, { assets: '/media' });
  const guide = await plugin.loadContent();
  assert.deepEqual(guide, JSON.parse(readFileSync(example, 'utf8')));
  const [link, data] = plugin.injectHtmlTags({ content: { title: 'a </script> b' } }).headTags;
  assert.equal(link.attributes.href, '/docs/assets/buildguide/buildguide.css');
  assert.equal(data, '<script type="application/json" id="buildguide-data" data-core="/docs/assets/buildguide/" data-assets="/docs/media/">{"title":"a \\u003c/script> b"}</script>');
});

test('assets is a folder below baseUrl', () => {
  const url = (assets) => site(example, assets === undefined ? {} : { assets }).injectHtmlTags({ content: {} }).headTags[1].match(/data-assets="([^"]*)"/)[1];
  assert.deepEqual([undefined, '/', '', '/media', 'media/', 'a/b'].map(url), ['/docs/assets/', '/docs/', '/docs/', '/docs/media/', '/docs/media/', '/docs/a/b/']);
});

test('assets with very many slashes is trimmed in linear time', () => {
  const start = performance.now();
  const inner = '/'.repeat(100000);
  const url = site(example, { assets: `//a${inner}x//` }).injectHtmlTags({ content: {} }).headTags[1].match(/data-assets="([^"]*)"/)[1];
  assert.equal(url, `/docs/a${inner}x/`);
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
    assert.match(error.message, /^\/boards\/wiring\/steps\/0\/note: must be string$/m);
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
