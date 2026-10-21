// Copies packages/core/src into core/ (git-ignored), the folder the plugin serves and packs. See #7.
import { cpSync, rmSync } from 'node:fs';

rmSync('core', { recursive: true, force: true });
cpSync('../core/src', 'core', { recursive: true });
