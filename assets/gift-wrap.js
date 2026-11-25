/* Gift wrap add-on (snippets/gift-wrap.liquid): one per order, quantity 0 or 1 via cart/update.js.
   <gift-wrap> sits in the drawer footer, <gift-wrap-pdp> under the product page buy buttons.
   After an update only the drawer's inner element and the bubble are repainted (the drawer is not opened), then the
   cart is published as source 'cart-items', which the drawer's own listener ignores. */
(() => {
  const parse = (html, sel) => new DOMParser().parseFromString(html, 'text/html').querySelector(sel);
  const all = (sel) => document.querySelectorAll(sel);
  let busy = false;
  const setBusy = (on) => {
    busy = on;
    all('gift-wrap, gift-wrap-pdp').forEach((el) => el.toggleAttribute('aria-busy', on));
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
        const inCart = state.items.some((i) => String(i.variant_id) === String(id));
        all('gift-wrap-pdp input').forEach((el) => { el.checked = inCart; });
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: state });
      })
      .catch(() => all('gift-wrap input, gift-wrap-pdp input').forEach((el) => { el.checked = !qty; }))
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

  customElements.get('gift-wrap-pdp') || customElements.define('gift-wrap-pdp', class extends HTMLElement {
    connectedCallback() {
      const box = this.querySelector('input');
      guard(box);
      // Empty cart: only remember the tick; afterAdd() adds the wrap once the product is in (else it would be alone).
      box.addEventListener('change', () => {
        if (!document.querySelector('cart-drawer.is-empty')) setWrap(this.dataset.variant, box.checked ? 1 : 0);
      });
      // Product forms and the bundle-save section publish their adds; the bundle builder calls afterAdd() itself.
      this.unsubscribe = subscribe(PUB_SUB_EVENTS.cartUpdate, (e) => {
        if (e.source === 'product-form' || e.source === 'pm-bundle-save') this.afterAdd();
      });
    }
    disconnectedCallback() { this.unsubscribe?.(); }
    afterAdd() {
      return this.querySelector('input').checked ? setWrap(this.dataset.variant, 1) : Promise.resolve();
    }
  });
})();
