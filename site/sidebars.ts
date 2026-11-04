import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

// The groups are headings, not toggles: every page is one click away, in the phone menu too
const group = (label: string, items: { id: string; label: string }[]) => ({
  type: 'category' as const,
  label,
  collapsible: false,
  items: items.map((item) => ({ type: 'doc' as const, ...item })),
})

export default {
  docs: [
    { type: 'doc', id: 'index', label: 'Home' },
    group('Getting started', [
      { id: 'core', label: 'Plain HTML' },
      { id: 'mkdocs', label: 'MkDocs' },
      { id: 'docusaurus', label: 'Docusaurus' },
    ]),
    group('Guides', [
      { id: 'examples', label: 'Examples' },
      { id: 'data-format', label: 'Data format' },
      { id: 'theming', label: 'Theming and dark mode' },
      { id: 'reference', label: 'Reference' },
      { id: 'testing', label: 'Testing your site' },
      { id: 'offline', label: 'Offline use' },
    ]),
    group('Example guide', [
      { id: 'example/index', label: 'Introduction' },
      { id: 'example/bom', label: 'BOM' },
      { id: 'example/steps', label: 'Steps' },
      { id: 'example/wiring', label: 'Wiring' },
      { id: 'example/tubing', label: 'Tubing' },
      { id: 'example/all', label: 'All components' },
      { id: 'example/guide', label: 'Combined' },
      { id: 'example/second', label: 'Two guides' },
    ]),
  ],
} satisfies SidebarsConfig
