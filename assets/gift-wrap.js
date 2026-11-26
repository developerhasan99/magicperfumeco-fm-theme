/* Gift wrap add-on (snippets/gift-wrap.liquid): one per order, quantity 0 or 1 via cart/update.js.
   <gift-wrap> sits in the drawer footer.
   After an update only the drawer's inner element and the bubble are repainted (the drawer is not opened), then the
   cart is published as source 'cart-items', which the drawer's own listener ignores. */
(() => {
  const parse = (html, sel) => new DOMParser().parseFromString(html, 'text/html').querySelector(sel);
  const all = (sel) => document.querySelectorAll(sel);
  let busy = false;
  const setBusy = (on) => {
    busy = on;
    all('gift-wrap').forEach((el) => el.toggleAttribute('aria-busy', on));
  };

  const setWrap = (id, qty) => {
    setBusy(true);
    return fetch(routes.cart_update_url, {
      ...fetchConfig(),
      body: JSON.stringify({ updates: { [id]: qty }, sections: 'cart-drawer,cart-icon-bubble' }),
    })
      .then((r) => r.json())
      // A drawer refresh started by an add (assets/cart.js onCartUpdate) may still be in flight with an older cart: paint after it.
      .then((state) => Promise.resolve(window.cartDrawerRefresh).catch(() => {}).then(() => state))
      .then((state) => {
        if (!state.sections) throw new Error(state.description || 'cart update failed');
        const inner = document.querySelector('#CartDrawer .drawer__inner');
        const bubble = document.getElementById('cart-icon-bubble');
        const newInner = state.sections['cart-drawer'] && parse(state.sections['cart-drawer'], '.drawer__inner');
        const newBubble = state.sections['cart-icon-bubble'] && parse(state.sections['cart-icon-bubble'], '.shopify-section');
        if (inner && newInner) inner.innerHTML = newInner.innerHTML;
        if (bubble && newBubble) bubble.innerHTML = newBubble.innerHTML;
        document.querySelector('cart-drawer')?.classList.toggle('is-empty', state.item_count === 0);
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: state });
      })
      .catch(() => all('gift-wrap input').forEach((el) => { el.checked = !qty; }))
      .finally(() => setBusy(false));
  };

  // One request at a time: while busy, clicks (and Space) on any gift wrap checkbox do nothing.
  const guard = (box) => box.addEventListener('click', (e) => { if (busy) e.preventDefault(); });

  customElements.get('gift-wrap') || customElements.define('gift-wrap', class extends HTMLElement {
    connectedCallback() {
      const box = this.querySelector('input');
      const id = this.dataset.variant;
      guard(box);
      box.addEventListener('change', () => {
        setWrap(id, box.checked ? 1 : 0).then(() => document.querySelector('gift-wrap input')?.focus());
      });
      if (this.dataset.fix !== undefined) setWrap(id, Number(this.dataset.fix));
    }
  });

})();
