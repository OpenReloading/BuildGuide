/* BuildGuide image zoom: a BOM image enlarged in a modal dialog, with its alt text below it. buildguide.js loads this file on the
   first click on an image and calls the function with the component's root and the image button; it returns a function that closes the dialog. */
window.BuildGuideModules = {...window.BuildGuideModules, zoom: (root, opener) => {
  const small = opener.querySelector('img'), key = opener.dataset.zoom;
  const dialog = document.createElement('dialog'), close = document.createElement('button'), figure = document.createElement('figure'), image = new Image();
  // in the body, so a render of the component keeps it; .ag-guide gives it the tokens, data-ag-scheme the component's scheme
  dialog.className = 'ag-guide ag-zoom-dialog';
  const scheme = root.closest('[data-ag-scheme]')?.dataset.agScheme;
  if (scheme) dialog.dataset.agScheme = scheme;
  dialog.setAttribute('aria-label', opener.closest('tr')?.querySelector('strong')?.textContent || 'Image');
  close.type = 'button'; close.textContent = 'Close'; close.onclick = () => dialog.close();
  image.src = small.currentSrc || small.src; image.alt = small.alt;
  figure.append(image);
  if (small.alt) { const caption = document.createElement('figcaption'); caption.textContent = small.alt; caption.ariaHidden = 'true'; figure.append(caption); }
  dialog.append(close, figure);
  // a click on the backdrop closes it too; the focus returns to the image, or to its button after a render replaced it
  dialog.onclick = e => { if (e.target === dialog) dialog.close(); };
  dialog.onclose = () => { dialog.remove(); (opener.isConnected ? opener : root.querySelector(`[data-zoom="${CSS.escape(key)}"]`))?.focus(); };
  document.body.append(dialog);
  dialog.showModal();
  return () => dialog.open && dialog.close();
}};
