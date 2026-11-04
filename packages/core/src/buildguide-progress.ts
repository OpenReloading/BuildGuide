/* BuildGuide progress tools: export, import, reset and undo of the saved ticks. buildguide.js loads this file on the first click
   and calls the function with the context of one component (its state through accessors), the action and its argument. */
window.BuildGuideModules = {...window.BuildGuideModules, progress: async (c, ...[action, arg]) => {
  const {D: {storage}, t} = c;
  const store = (progress: BuildGuideProgress) => { try { localStorage.setItem(storage, JSON.stringify(progress)); } catch { c.fail(); } };
  const before = c.saved();
  if (action === 'export') c.download(new Blob([JSON.stringify(before, null, 2)], {type: 'application/json'}), `${storage}.json`);
  if (action === 'import') {
    let progress: unknown;
    try { progress = arg.size < 1e6 && JSON.parse(await arg.text()); } catch {}
    if (!c.alive()) return;
    if (!c.isProgress(progress)) { c.say(t(arg.size < 1e6 ? 'notProgress' : 'tooLarge')); return; }
    // what is stored now, read after the file: a tick made meanwhile is part of what Undo restores
    const now = c.saved();
    store(progress);
    c.share(progress, t(c.ok() ? 'imported' : 'importedNotSaved'), now);
  }
  if (action === 'reset') {
    try { localStorage.removeItem(storage); } catch { c.fail(); }
    c.share({}, t(c.ok() ? 'reset' : 'resetNotSaved'), before);
  }
  if (action === 'undo') {
    store(arg);
    c.root.querySelector<HTMLElement>('[data-action=reset-progress]')?.focus();
    c.share(arg, t(c.ok() ? 'restored' : 'restoredNotSaved'));
  }
}};
