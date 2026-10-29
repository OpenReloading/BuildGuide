// Types for `tsc --checkJs` over src/ (npm run typecheck). Kept outside src/ so the shipped files and their gzip size do not change.

// The guide data, as in schema/buildguide.schema.json
type Point = [number, number];
type Note = string | { level: 'note' | 'caution' | 'warning'; text: string };

interface BomItem { id: string; group: string; part: string; spec?: string; qty: number | string; image?: string; link?: string }
interface TextStep { id: string; title: string; text?: string; note?: Note; parts?: string[] }

interface Connection { no: string; a: string; b: string; color: string; la?: string; lb?: string; cable?: string; size?: string }
interface BoardStep { id: string; title: string; note?: Note; connections: Connection[] }
interface Board {
  title: string;
  label?: string;
  size: Point;
  prefix?: string;
  scope?: 'step' | 'all';
  single?: boolean;
  listAll?: boolean;
  listColor?: boolean;
  legend?: (string | { text: string; key?: 'diode' })[];
  colors: Record<string, { line: string; outline: string; swatch?: string; width?: number; diode?: boolean }>;
  kinds?: Record<string, {
    fill?: string; stroke?: string; rx?: number; round?: boolean; inset?: number; offset?: { top?: number; bottom?: number };
    pins?: Record<string, string>; band?: boolean | string; diodeLoop?: 'around';
  }>;
  rules?: { perTerminal?: number; exempt?: { kinds?: string[]; colors?: string[] } };
  areas?: Record<string, { title: string; at: Point; size: Point; color?: string; frame?: boolean; glands?: [number, string][] }>;
  props?: { name: string; at: Point; size: Point }[];
  parts: Record<string, {
    kind?: string; name?: string; sub?: string; color?: string; at: Point; size: Point;
    ports: Partial<Record<'left' | 'right' | 'top' | 'bottom', string[]>>;
  }>;
  steps: BoardStep[];
}

interface Guide {
  $schema?: string;
  storage: string;
  bom?: { note?: string; export?: string; linkLabel?: string; items: BomItem[] };
  steps?: { title?: string; note?: string; items: TextStep[] };
  boards?: Record<string, Board>;
}

// The globals that buildguide.js and its on-demand files set, and the ones they read from the host page
interface MountOptions { view?: 'bom' | 'steps' | 'board' | 'guide'; board?: string; assets?: string }
interface BoardOptions {
  key: string; name: string; step: number; wire: number; scope: string; zoom: number; base: string; focus?: string;
  label(connection: Connection, end: string): string; zoomed?(zoom: number): void; done?(no: string): boolean; select(no: string): void;
}
// root and board of BuildGuideBoard stay untyped until strict mode: a type here also types the body of buildguide-board.js
interface BoardDrawing { destroy(): void; zoomBy(step: number): number; fit(): void; highlight(no: string, on?: boolean): void }

interface Window {
  BuildGuide: { mount(root: Element, data: Guide, options?: MountOptions): () => void; scan(): void };
  BuildGuideBoard: ((root, board, options: BoardOptions) => BoardDrawing) & { wheelFactor?(delta: number, mode: number): number };
  BuildGuideModules: Record<string, (context, action: string, arg?) => unknown>;
  joint; // the diagram library that buildguide.js loads before buildguide-board.js
  document$?: { subscribe(callback: () => void): void }; // Material for MkDocs instant navigation
}
declare const joint;

// What the browsers do that the DOM and ES libraries leave out
interface Element { readonly dataset: DOMStringMap } // HTML, SVG and MathML elements all have it
interface SVGScriptElement { readonly src: string } // only to read document.currentScript.src: core always loads from an HTML script element
interface String { charCodeAt(): number } // the index defaults to 0
interface ErrorConstructor { new (message?: number): Error } // the message is converted to a string
