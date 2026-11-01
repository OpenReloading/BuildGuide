// The mobile navigation drawer by keyboard. Material's section and table of contents toggles are labels of hidden
// checkboxes, and a label of a control takes no role (ARIA in HTML). So each checkbox gets a button of its own in the
// drawer: it sits where the label is, its focus ring shows on the label while the pane is closed and on the pane's
// title while it is open (site-theme.css), and aria-expanded follows the checkbox. What is out of view leaves the tab
// order: a closed drawer, a closed pane and the level under an open pane.
(() => {
  const drawer = matchMedia("(max-width: 76.234375em)");
  const sync = () => {
    const sidebar = document.querySelector(".md-sidebar--primary");
    if (!sidebar) return;
    for (const box of sidebar.querySelectorAll(".md-nav__toggle")) {
      if (!box.parentElement.querySelector(":scope > .md-nav")) continue;
      let button = box.nextElementSibling;
      if (!button.matches(".bg-nav-toggle")) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "bg-nav-toggle";
        button.textContent = box.nextElementSibling.textContent.trim();
        button.addEventListener("click", () => box.click());
        box.after(button);
      }
      button.setAttribute("aria-expanded", box.checked);
    }
    for (const e of sidebar.querySelectorAll("[inert]")) e.inert = false;
    sidebar.inert = drawer.matches && !document.getElementById("__drawer").checked;
    if (!drawer.matches) return;
    for (const pane of sidebar.querySelectorAll(".md-nav__toggle:not(:checked) ~ .md-nav")) pane.inert = true;
    // inert holds for all descendants, so along the path to the open pane only the siblings leave
    const inner = nav => nav.querySelector(":scope > .md-nav__list > li > .md-nav__toggle:checked ~ .md-nav");
    for (let open = sidebar.querySelector(".md-nav--primary"), next = inner(open); next; open = next, next = inner(open)) {
      for (let e = next; e !== open; e = e.parentElement) {
        for (const s of e.parentElement.children) if (s !== e && !s.matches("input, [aria-expanded=true]")) s.inert = true;
      }
    }
  };
  document.addEventListener("change", e => {
    if (e.target.id === "__drawer" || e.target.matches(".md-nav__toggle")) sync();
  });
  drawer.addEventListener("change", sync);
  window.document$.subscribe(sync);
})();
