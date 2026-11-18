/* mgx-aria-de (05.11.2026): German screen-reader labels in place of the English ones that scripts we
   don't own set at runtime: Swiper navigation (all sliders) and the Judge.me review widget. Theme markup
   is German already; this only rewrites aria-label values that match the known English patterns, so it
   never touches anything else. Runs on every aria-label added or changed after load. */
(function () {
  var exact = {
    'Previous slide': 'Vorherige Folie',
    'Next slide': 'Nächste Folie',
    'This is the first slide': 'Das ist die erste Folie',
    'This is the last slide': 'Das ist die letzte Folie',
    'Go to previous page': 'Zur vorherigen Seite',
    'Go to next page': 'Zur nächsten Seite'
  };
  var rules = [
    [/^Go to slide (\d+)$/, 'Gehe zu Folie $1'],
    [/^Go to item (\d+)$/, 'Gehe zu Bild $1'],
    [/^Go to page (\d+)$/, 'Gehe zu Seite $1'],
    [/^Thumbnails for (\d+) items$/, 'Vorschaubilder ($1)'],
    [/^(\d+(?:[.,]\d+)?) out of 5 stars$/, '$1 von 5 Sternen'],
    [/^(\d+)% \(([\d.,]+)\) reviews with (\d) star rating$/, '$1 % ($2) Bewertungen mit $3 Sternen'],
    [/^View (.+) product page$/, 'Produktseite ansehen: $1']
  ];
  function translate(v) {
    if (exact.hasOwnProperty(v)) return exact[v];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i][0].test(v)) return v.replace(rules[i][0], rules[i][1]);
    }
    return null;
  }
  function fix(el) {
    if (!el || el.nodeType !== 1) return;
    var v = el.getAttribute('aria-label');
    if (!v) return;
    var t = translate(v.trim());
    if (t && t !== v) el.setAttribute('aria-label', t);
  }
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    fix(root);
    var els = root.querySelectorAll('[aria-label]');
    for (var i = 0; i < els.length; i++) fix(els[i]);
  }
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'attributes') fix(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
  scan(document.documentElement);
  document.addEventListener('DOMContentLoaded', function () { scan(document.documentElement); });
})();
