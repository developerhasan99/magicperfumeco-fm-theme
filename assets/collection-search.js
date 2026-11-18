/**
 * Collection search (snippets/collection-search.liquid): filters the product grid of
 * sections/main-collection-product-grid.liquid by scent name, number, brand, inspiration and
 * tags, like the search on magicperfume.co's bundle page.
 *
 * Each product <li> carries data-mgx-hay ("title | inspiration") and data-mgx-tags ("tag|tag").
 * The first use loads every remaining page (window.mgxCollectionGrid.loadAll from
 * assets/collection-grid-loader.js), so the whole collection is searched, and the query is
 * re-applied after every page load and after Dawn's filters or sort replace the grid.
 */
(() => {
  const DEBOUNCE_MS = 120;
  // Matching (folding, synonyms, tag words, numbers, word starts) lives in
  // assets/mgx-search-core.js (window.mgxSearchCore), shared with the search overlay;
  // snippets/collection-search.liquid loads it before this file.
  const core = () => window.mgxSearchCore;
  const parseQuery = (raw) => core().parseQuery(raw);

  const cache = new WeakMap();
  const hayFor = (li) => {
    const cached = cache.get(li);
    if (cached) return cached;
    const [title = '', ...rest] = (li.dataset.mgxHay || '').split(' | ');
    const entry = core().buildHay(title, rest.join(' '), li.dataset.mgxTags);
    cache.set(li, entry);
    return entry;
  };

  // Bundles (tag "bundle") never match a query: search leaves them out everywhere.
  const isBundle = (li) =>
    (li.dataset.mgxTags || '').split('|').some((tag) => tag.trim().toLowerCase() === 'bundle');

  const matches = (li, query) => !isBundle(li) && core().matches(hayFor(li), query);

  const fill = (template, values) =>
    String(template || '').replace(/\[(count|query)\]/g, (_, key) => values[key]);

  const init = (root) => {
    if (root.dataset.mgxReady) return;
    root.dataset.mgxReady = '1';
    const input = root.querySelector('.mgx-csearch__input');
    const clear = root.querySelector('.mgx-csearch__clear');
    const status = root.querySelector('.mgx-csearch__status');
    const field = root.querySelector('.mgx-csearch__field');
    if (!input || !status) return;
    const text = root.dataset;
    let query = parseQuery('');
    let raw = '';
    let timer = null;

    const loader = () => window.mgxCollectionGrid;
    const complete = () => {
      const grid = loader();
      return !grid || grid.isComplete() || !grid.isLoading();
    };

    let statusKey = '';
    const setStatus = (key, build) => {
      if (key === statusKey) return;
      statusKey = key;
      status.textContent = '';
      if (build) build();
    };
    const renderStatus = (count, grid) => {
      const loading = query.terms.length > 0 && !complete();
      if (grid) {
        if (loading) grid.setAttribute('aria-busy', 'true');
        else grid.removeAttribute('aria-busy');
      }
      if (!query.terms.length) return setStatus('', null);
      const shown = raw.trim();
      if (loading) return setStatus('loading', () => status.append(text.loadingText || ''));
      if (count === 0) {
        return setStatus(`empty:${shown}`, () => {
          status.append(fill(text.emptyText, { query: shown }), ' ');
          const reset = document.createElement('button');
          reset.type = 'button';
          reset.className = 'mgx-csearch__reset';
          reset.textContent = text.clearLabel || 'Suche löschen';
          reset.addEventListener('click', () => {
            setQuery('');
            input.focus();
          });
          status.append(reset);
        });
      }
      const line = fill(count === 1 ? text.resultText : text.resultsText, { count, query: shown });
      return setStatus(line, () => status.append(line));
    };

    const apply = () => {
      const grid = document.getElementById('product-grid');
      if (!grid || grid.tagName !== 'UL') {
        setStatus('', null);
        return;
      }
      const active = query.terms.length > 0;
      let count = 0;
      [...grid.children].forEach((li) => {
        if (!li.classList.contains('grid__item')) return;
        const isProduct = !!li.dataset.mgxPid;
        const hide = active && (!isProduct || !matches(li, query));
        if (hide) {
          li.hidden = true;
          li.dataset.mgxCsHidden = '';
        } else if ('mgxCsHidden' in li.dataset) {
          li.hidden = false;
          delete li.dataset.mgxCsHidden;
        }
        if (active && isProduct && !hide) count += 1;
      });
      renderStatus(count, grid);
    };

    const loadAll = () => {
      const grid = loader();
      if (grid && !grid.isComplete()) grid.loadAll().then(apply);
    };

    function setQuery(value) {
      clearTimeout(timer);
      raw = value;
      if (input.value !== value) input.value = value;
      query = parseQuery(value);
      if (clear) clear.hidden = !value;
      if (query.terms.length) loadAll();
      apply();
    }

    input.addEventListener('input', () => {
      if (clear) clear.hidden = !input.value;
      clearTimeout(timer);
      timer = setTimeout(() => setQuery(input.value), DEBOUNCE_MS);
    });
    // Start loading the rest of the collection as soon as the shopper is about to type.
    input.addEventListener('focus', loadAll, { once: true });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        event.stopPropagation();
        setQuery('');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        setQuery(input.value);
        input.blur();
      }
    });
    if (clear) {
      clear.addEventListener('click', () => {
        setQuery('');
        input.focus();
      });
    }
    if (field) {
      field.addEventListener('click', (event) => {
        if (event.target === field) input.focus();
      });
    }
    // Page-level listeners stop with this bar: the theme editor re-renders the section.
    const listeners = new AbortController();
    const live = (handler) => (...args) => (root.isConnected ? handler(...args) : listeners.abort());
    const opts = { signal: listeners.signal };
    document.addEventListener('mgx:grid:append', live(apply), opts);
    document.addEventListener('mgx:grid:complete', live(apply), opts);
    document.addEventListener(
      'mgx:grid:replace',
      live(() => {
        if (query.terms.length) loadAll();
        apply();
      }),
      opts
    );
    // Back/forward cache or browser autofill can leave text in the box.
    window.addEventListener(
      'pageshow',
      live(() => {
        if (input.value !== raw) setQuery(input.value);
      }),
      opts
    );
    if (input.value) setQuery(input.value);
  };

  const start = () => document.querySelectorAll('[data-mgx-csearch]').forEach(init);
  // On a normal page load the deferred core has already run; when a theme-editor re-render
  // brings both files in at once, wait for the core.
  const ready = () => {
    if (core()) start();
    else document.addEventListener('mgx:search-core:ready', start, { once: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  document.addEventListener('shopify:section:load', ready);

  window.mgxCollectionSearch = {
    fold: (value) => core().fold(value),
    parseQuery,
    // QA: does a product with this title and tags match the query?
    matchText: (title, tags, raw) => {
      const li = document.createElement('li');
      li.dataset.mgxHay = `${title} | `;
      li.dataset.mgxTags = Array.isArray(tags) ? tags.join('|') : tags || '';
      return matches(li, parseQuery(raw));
    },
  };
})();
