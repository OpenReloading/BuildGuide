/* BuildGuide progress tools: export, import, reset and undo of the saved ticks. buildguide.js loads this file on the first click
   and calls the function with the context of one component (its state through accessors), the action and its argument. */
window.BuildGuideModules = {...window.BuildGuideModules, progress: async (c, action, arg) => {
  'use strict';
  const {storage} = c.D;
  const store = progress => { try { localStorage.setItem(storage, JSON.stringify(progress)); } catch { c.fail(); } };
  const before = c.saved();
  if (action === 'export') c.download(new Blob([JSON.stringify(before, null, 2)], {type: 'application/json'}), `${storage}.json`);
  if (action === 'import') {
    let progress;
    try { progress = arg.size < 1e6 && JSON.parse(await arg.text()); } catch {}
    if (!c.alive()) return;
    if (!c.isProgress(progress)) { c.say(arg.size < 1e6 ? 'Not imported: the file is not a progress export.' : 'Not imported: the file is larger than 1 MB.'); return; }
    // what is stored now, read after the file: a tick made meanwhile is part of what Undo restores
    const now = c.saved();
    store(progress);
    c.share(progress, c.ok() ? 'Progress imported.' : 'Imported, but storage is unavailable: progress is not saved.', now);
  }
  if (action === 'reset') {
    try { localStorage.removeItem(storage); } catch { c.fail(); }
    c.share({}, c.ok() ? 'Progress reset.' : 'Reset for this visit: storage is unavailable.', before);
  }
  if (action === 'undo') {
    store(arg);
    c.root.querySelector('[data-action=reset-progress]').focus();
    c.share(arg, c.ok() ? 'Progress restored.' : 'Restored for this visit: storage is unavailable.');
  }
}};
