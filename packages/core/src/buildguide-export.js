/* BuildGuide export: the CSV of a BOM or of a board, and the print list of a board (every connection of every step, grouped by step).
   buildguide.js loads this file when a board renders, since printing cannot wait for a load, or on the first Export CSV, and calls the
   function with the context of one component and the action, 'csv' or 'print'. */
window.BuildGuideModules = {...window.BuildGuideModules, export: (c, action) => {
  const {board, bom, esc} = c, yes = done => done ? 'Yes' : 'No';
  const HEAD = ['No', 'From', 'To', 'Colour', 'Cable', 'Size', 'Done'];
  const rows = step => step.connections.map(x => [x.no, c.label(x, 'a'), c.label(x, 'b'), x.color, x.cable, x.size, yes(c.checked(c.connKey(x)))]);
  if (action === 'print') {
    const list = c.root.querySelector('.ag-print-list');
    if (list) list.innerHTML = `<table class="ag-table"><caption class="ag-sr">All connections by step</caption><thead><tr>${HEAD.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>${
      board.steps.map(s => `<tbody><tr class="ag-group"><th colspan="7" scope="rowgroup">${esc(s.title)}</th></tr>${rows(s).map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>`).join('')}</table>`;
    return;
  }
  const table = board ? [HEAD, ...board.steps.flatMap(rows)]
    : [['Group', 'Component', 'Specification', 'Quantity', bom.linkLabel || 'Link', 'Done'], ...c.parts().map(p => [p.group, p.part, p.spec, p.qty, p.link || '', yes(c.checked(c.bomKey(p)))])];
  // a leading = + - @ would run as a spreadsheet formula
  const cell = v => '"' + String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
  c.download(new Blob(['﻿' + table.map(r => r.map(cell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}), board ? c.boardKey + '.csv' : bom.export || 'bom.csv');
}};
