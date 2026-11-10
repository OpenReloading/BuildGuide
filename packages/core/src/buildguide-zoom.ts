/* BuildGuide image zoom: a BOM image enlarged in a modal dialog, with its alt text below it. buildguide.js loads this file on the
   first click on an image and calls the function with the component's context and the image's data-zoom key (the item id); it returns a function
   that closes the dialog. */
window.BuildGuideModules = {...window.BuildGuideModules, zoom: (c, key) => {
  const {root, t} = c, find = () => root.querySelector<HTMLElement>(`[data-zoom="${CSS.escape(key)}"]`), small = find()?.querySelector('img');
  if (!small) return () => {};   // a render hid the row while this file loaded
  const dialog = document.createElement('dialog'), close = document.createElement('button'), figure = document.createElement('figure'), image = new Image();
  // in the body, so a render of the component keeps it; .ag-guide, the component's own token values and color scheme give it the component's look
  dialog.className = 'ag-guide ag-zoom-dialog';
  const style = getComputedStyle(root);
  for (const name of style) if (name.startsWith('--ag-')) dialog.style.setProperty(name, style.getPropertyValue(name));
  dialog.style.colorScheme = style.colorScheme;
  // in the body it would take the page's language: it keeps the component's, so its texts are read in that language
  const lang = root.closest<HTMLElement>('[lang]')?.lang;
  if (lang) dialog.lang = lang;
  dialog.setAttribute('aria-label', small.closest('tr')?.querySelector('strong')?.textContent || t('image'));
  close.type = 'button'; close.textContent = t('close'); close.onclick = () => dialog.close();
  image.src = small.currentSrc || small.src; image.alt = small.alt;
  figure.append(image);
  if (small.alt) { const caption = document.createElement('figcaption'); caption.textContent = small.alt; caption.ariaHidden = 'true'; figure.append(caption); }
  dialog.append(close, figure);
  // a click on the backdrop closes it too; the focus returns to the image button (a render may have replaced it), or to the filter that hid its row
  dialog.onclick = e => { if (e.target === dialog) dialog.close(); };
  dialog.onclose = () => { dialog.remove(); (find() ?? root.querySelector<HTMLElement>('[data-role=filter]'))?.focus(); };
  document.body.append(dialog);
  dialog.showModal();
  return () => dialog.open && dialog.close();
}};
