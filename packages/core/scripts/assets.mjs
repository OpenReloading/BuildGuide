// Completes lib/, the folder that ships, after tsc -b has emitted the scripts and the check CLI into it: the stylesheet and the
// unmodified third-party files go next to them, since buildguide.js loads its siblings from its own URL.
import { cpSync } from 'node:fs';

cpSync('src/buildguide.css', 'lib/buildguide.css');
cpSync('src/vendor', 'lib/vendor', { recursive: true });
