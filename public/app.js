/**
 * BUSRIFY E-Commerce Store - Client Application Engine
 */

class BusrifyStore {
  constructor() {
    this.products = [];
    this.categories = [];
    this.cart = this.loadCart();
    this.currentUser = null;
    this.currentProductInModal = null;
    this.appliedPromo = null;

    // Filters
    this.filters = {
      category: 'all',
      search: '',
      sort: 'featured',
      price: 'all'
    };

    // Initialize application
    this.init();
  }

  // Currency Formatter Helper (Indian Rupees)
  formatINR(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  async init() {
    this.initTheme();
    this.bindEvents();
    await this.checkAuthStatus();
    await this.checkDatabaseStatus();
    await this.loadCategories();
    await this.fetchProducts();
    this.renderCart();
  }

  async checkDatabaseStatus() {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        const dot = document.getElementById('dbIndicatorDot');
        const text = document.getElementById('dbIndicatorText');
        if (dot && text) {
          if (data.database === 'mongodb') {
            dot.style.background = '#10b981';
            text.textContent = 'MongoDB: Connected';
          } else {
            dot.style.background = '#f59e0b';
            text.textContent = 'Database: SQLite (MongoDB Fallback)';
          }
        }
      }
    } catch (err) {
      console.warn('Could not query database status:', err);
    }
  }

  // =========================================================
  // Theme Management
  // =========================================================
  initTheme() {
    const savedTheme = localStorage.getItem('busrify_theme') || localStorage.getItem('lumina_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('busrify_theme', newTheme);
    this.showToast(`Switched to ${newTheme} mode`, 'info');
  }

  // =========================================================
  // Event Binding
  // =========================================================
  bindEvents() {
    // Theme toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => this.toggleTheme());

    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    let searchDebounceTimer;

    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const query = e.target.value.trim();
      clearSearchBtn.style.display = query ? 'block' : 'none';

      searchDebounceTimer = setTimeout(() => {
        this.filters.search = query;
        this.fetchProducts();
      }, 250);
    });

    clearSearchBtn?.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      this.filters.search = '';
      this.fetchProducts();
    });

    // Category pills
    const categoryPillsContainer = document.getElementById('categoryPills');
    categoryPillsContainer?.addEventListener('click', (e) => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;

      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      this.filters.category = pill.dataset.category;
      this.fetchProducts();
    });

    // Footer category links
    document.querySelectorAll('.footer-links a[data-cat]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = link.dataset.cat;
        this.filters.category = cat;
        document.querySelectorAll('.category-pill').forEach(p => {
          p.classList.toggle('active', p.dataset.category === cat);
        });
        this.fetchProducts();
        document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Sort & Price selects
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      this.filters.sort = e.target.value;
      this.fetchProducts();
    });

    document.getElementById('priceFilter')?.addEventListener('change', (e) => {
      this.filters.price = e.target.value;
      this.fetchProducts();
    });

    // Reset filters buttons
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => this.resetFilters());
    document.getElementById('emptyResetBtn')?.addEventListener('click', () => this.resetFilters());

    // Cart drawer toggle
    document.getElementById('cartToggleBtn')?.addEventListener('click', () => this.openCartDrawer());
    document.getElementById('closeCartBtn')?.addEventListener('click', () => this.closeCartDrawer());
    document.getElementById('cartOverlay')?.addEventListener('click', () => this.closeCartDrawer());
    document.getElementById('continueShoppingBtn')?.addEventListener('click', () => this.closeCartDrawer());
    document.getElementById('clearCartBtn')?.addEventListener('click', () => this.clearCart());

    // Promo code apply
    document.getElementById('applyPromoBtn')?.addEventListener('click', () => this.applyPromoCode());
    document.getElementById('promoInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.applyPromoCode();
      }
    });

    // Hero buttons
    document.getElementById('heroPromoBtn')?.addEventListener('click', () => {
      this.showToast('Special Promos: Use BUSRIFY25 for 25% off, or SAVE10 for 10% off!', 'info');
    });

    document.getElementById('heroCardBuyBtn')?.addEventListener('click', () => {
      if (this.products.length > 0) {
        this.openProductModal(this.products[0]);
      }
    });

    // Product Modal controls
    document.getElementById('closeProductModalBtn')?.addEventListener('click', () => this.closeProductModal());
    document.getElementById('productModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'productModal') this.closeProductModal();
    });

    const modalQtyInput = document.getElementById('modalQtyInput');
    document.getElementById('modalQtyMinus')?.addEventListener('click', () => {
      let val = parseInt(modalQtyInput.value, 10) || 1;
      if (val > 1) modalQtyInput.value = val - 1;
    });
    document.getElementById('modalQtyPlus')?.addEventListener('click', () => {
      let val = parseInt(modalQtyInput.value, 10) || 1;
      if (this.currentProductInModal && val < this.currentProductInModal.stock) {
        modalQtyInput.value = val + 1;
      }
    });

    document.getElementById('modalAddToCartBtn')?.addEventListener('click', () => {
      if (!this.currentProductInModal) return;
      const qty = parseInt(modalQtyInput.value, 10) || 1;
      this.addToCart(this.currentProductInModal, qty);
      this.closeProductModal();
    });

    document.getElementById('modalBuyNowBtn')?.addEventListener('click', () => {
      if (!this.currentProductInModal) return;
      const qty = parseInt(modalQtyInput.value, 10) || 1;
      this.addToCart(this.currentProductInModal, qty);
      this.closeProductModal();
      this.openCheckoutModal();
    });

    // Checkout Modal controls
    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
      this.closeCartDrawer();
      this.openCheckoutModal();
    });

    document.getElementById('closeCheckoutModalBtn')?.addEventListener('click', () => this.closeCheckoutModal());
    document.getElementById('cancelCheckoutBtn')?.addEventListener('click', () => {
      this.closeCheckoutModal();
      this.openCartDrawer();
    });
    document.getElementById('backToShippingBtn')?.addEventListener('click', () => this.showCheckoutStep(1));
    document.getElementById('continueShoppingAfterCheckoutBtn')?.addEventListener('click', () => this.closeCheckoutModal());
    document.getElementById('viewMyOrdersAfterCheckoutBtn')?.addEventListener('click', () => {
      this.closeCheckoutModal();
      this.openProfileModal();
    });

    // Checkout forms
    document.getElementById('shippingForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.showCheckoutStep(2);
    });

    document.getElementById('paymentForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.processOrder();
    });

    // Payment radio selector highlighting & toggle
    document.querySelectorAll('.payment-option input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
        e.target.closest('.payment-option').classList.add('selected');

        const cardDetailsBox = document.getElementById('cardDetailsContainer');
        const upiGroup = document.getElementById('upiDetailsGroup');
        const cardFieldsGroup = document.getElementById('cardFieldsGroup');
        const val = e.target.value;

        if (val.includes('UPI')) {
          if (cardDetailsBox) cardDetailsBox.style.display = 'block';
          if (upiGroup) upiGroup.style.display = 'block';
          if (cardFieldsGroup) cardFieldsGroup.style.display = 'none';
        } else if (val.includes('Card')) {
          if (cardDetailsBox) cardDetailsBox.style.display = 'block';
          if (upiGroup) upiGroup.style.display = 'none';
          if (cardFieldsGroup) cardFieldsGroup.style.display = 'block';
        } else {
          // COD
          if (cardDetailsBox) cardDetailsBox.style.display = 'none';
        }
      });
    });

    // Auth & Profile Modal controls
    document.getElementById('userAccountBtn')?.addEventListener('click', () => {
      if (this.currentUser) {
        this.openProfileModal();
      } else {
        this.openAuthModal();
      }
    });

    document.getElementById('closeAuthModalBtn')?.addEventListener('click', () => this.closeAuthModal());
    document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => this.closeProfileModal());
    document.getElementById('authModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'authModal') this.closeAuthModal();
    });
    document.getElementById('profileModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'profileModal') this.closeProfileModal();
    });

    // Auth tabs
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    tabSignIn?.addEventListener('click', () => {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm.style.display = 'block';
      signUpForm.style.display = 'none';
    });

    tabSignUp?.addEventListener('click', () => {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signUpForm.style.display = 'block';
      signInForm.style.display = 'none';
    });

    // Fill Demo User button
    document.getElementById('fillDemoUserBtn')?.addEventListener('click', () => {
      document.getElementById('loginEmail').value = 'alex@example.com';
      document.getElementById('loginPassword').value = 'password123';
    });

    // Sign In & Register submissions
    signInForm?.addEventListener('submit', (e) => this.handleSignIn(e));
    signUpForm?.addEventListener('submit', (e) => this.handleSignUp(e));
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
  }

  // =========================================================
  // Product Catalog & Filtering
  // =========================================================
  async loadCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        this.categories = data.categories;
        this.updateCategoryCounts();
      }
    } catch (err) {
      console.warn('Failed to load categories', err);
    }
  }

  updateCategoryCounts() {
    let total = 0;
    this.categories.forEach(c => {
      total += c.count;
      const pill = document.querySelector(`.category-pill[data-category="${c.category}"]`);
      if (pill) {
        pill.innerHTML = `${c.category} <span class="pill-count">(${c.count})</span>`;
      }
    });
    const countAll = document.getElementById('countAll');
    if (countAll) countAll.textContent = `(${total})`;
  }

  async fetchProducts() {
    const params = new URLSearchParams();
    if (this.filters.category && this.filters.category !== 'all') {
      params.append('category', this.filters.category);
    }
    if (this.filters.search) {
      params.append('search', this.filters.search);
    }
    if (this.filters.sort) {
      params.append('sort', this.filters.sort);
    }

    if (this.filters.price === 'under5000') {
      params.append('maxPrice', 4999.99);
    } else if (this.filters.price === '5000to15000') {
      params.append('minPrice', 5000);
      params.append('maxPrice', 15000);
    } else if (this.filters.price === 'over15000') {
      params.append('minPrice', 15000.01);
    }

    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load catalog');
      const data = await res.json();
      this.products = data.products;
      this.renderProducts();
      this.updateFilterBanner();
    } catch (err) {
      console.error(err);
      this.showToast('Could not load products. Please check server.', 'error');
    }
  }

  renderProducts() {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid) return;

    grid.innerHTML = '';

    if (!this.products || this.products.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    this.products.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';

      const stars = '★'.repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? '½' : '');

      card.innerHTML = `
        <div class="product-card-img-wrap" data-id="${product.id}">
          ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
          <img src="${product.image_url}" alt="${product.name}" class="product-card-img" loading="lazy">
          <div class="quick-view-overlay">
            <button type="button" class="btn btn-secondary btn-sm quick-view-btn" data-id="${product.id}">
              Quick View
            </button>
          </div>
        </div>
        <div class="product-card-body">
          <div class="product-card-category">${product.category}</div>
          <h3 class="product-card-title" data-id="${product.id}">${product.name}</h3>
          
          <div class="product-card-rating">
            <span class="stars">${stars}</span>
            <span class="rating-num">${product.rating}</span>
            <span class="rating-count">(${product.reviews_count})</span>
          </div>

          <div class="stock-indicator ${product.stock <= 5 ? 'low' : ''}">
            <span class="stock-dot"></span>
            <span>${product.stock > 0 ? (product.stock <= 5 ? `Only ${product.stock} left in stock` : `In Stock (${product.stock})`) : 'Out of Stock'}</span>
          </div>

          <div class="product-card-pricing">
            <span class="product-price">${this.formatINR(product.price)}</span>
            ${product.original_price ? `<span class="product-original-price">${this.formatINR(product.original_price)}</span>` : ''}
          </div>

          <div class="product-card-actions">
            <button type="button" class="btn btn-primary btn-block add-to-cart-btn" data-id="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>
              ${product.stock > 0 ? 'Add to Cart' : 'Sold Out'}
            </button>
          </div>
        </div>
      `;

      // Event listeners on product card
      card.querySelectorAll('[data-id]').forEach(el => {
        if (el.classList.contains('add-to-cart-btn')) {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addToCart(product, 1);
          });
        } else {
          el.addEventListener('click', () => {
            this.openProductModal(product);
          });
        }
      });

      grid.appendChild(card);
    });
  }

  updateFilterBanner() {
    const banner = document.getElementById('filterStatusBanner');
    const text = document.getElementById('filterStatusText');
    const isFiltered = (this.filters.category !== 'all') || this.filters.search || (this.filters.price !== 'all');

    if (banner && isFiltered) {
      banner.style.display = 'flex';
      const parts = [];
      if (this.filters.category !== 'all') parts.push(`Category: "${this.filters.category}"`);
      if (this.filters.search) parts.push(`Search: "${this.filters.search}"`);
      if (this.filters.price !== 'all') parts.push(`Price: "${this.filters.price}"`);
      text.textContent = parts.join(' · ');
    } else if (banner) {
      banner.style.display = 'none';
    }
  }

  resetFilters() {
    this.filters = { category: 'all', search: '', sort: 'featured', price: 'all' };
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';

    document.querySelectorAll('.category-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.category === 'all');
    });

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'featured';

    const priceFilter = document.getElementById('priceFilter');
    if (priceFilter) priceFilter.value = 'all';

    this.fetchProducts();
  }

  // =========================================================
  // Product Details Modal
  // =========================================================
  openProductModal(product) {
    this.currentProductInModal = product;
    const modal = document.getElementById('productModal');
    if (!modal) return;

    document.getElementById('modalProductImg').src = product.image_url;
    document.getElementById('modalProductImg').alt = product.name;
    document.getElementById('modalProductCategory').textContent = product.category;
    document.getElementById('modalProductTitle').textContent = product.name;
    document.getElementById('modalProductPrice').textContent = this.formatINR(product.price);

    const origPriceEl = document.getElementById('modalProductOriginalPrice');
    const savingsEl = document.getElementById('modalProductSavings');
    if (product.original_price) {
      origPriceEl.textContent = this.formatINR(product.original_price);
      origPriceEl.style.display = 'inline';
      const savings = Math.round(((product.original_price - product.price) / product.original_price) * 100);
      savingsEl.textContent = `Save ${savings}%`;
      savingsEl.style.display = 'inline';
    } else {
      origPriceEl.style.display = 'none';
      savingsEl.style.display = 'none';
    }

    const badgeEl = document.getElementById('modalProductBadge');
    if (product.badge) {
      badgeEl.textContent = product.badge;
      badgeEl.style.display = 'block';
    } else {
      badgeEl.style.display = 'none';
    }

    document.getElementById('modalProductScore').textContent = product.rating;
    document.getElementById('modalProductReviews').textContent = `(${product.reviews_count} customer reviews)`;
    document.getElementById('modalProductStars').textContent = '★'.repeat(Math.floor(product.rating));
    document.getElementById('modalProductDesc').textContent = product.description;

    const stockEl = document.getElementById('modalProductStock');
    stockEl.textContent = product.stock > 0 
      ? `In Stock (${product.stock} units ready to ship)` 
      : 'Currently Out of Stock';
    stockEl.style.color = product.stock > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';

    // Reset qty
    const qtyInput = document.getElementById('modalQtyInput');
    qtyInput.value = 1;
    qtyInput.max = product.stock;

    // Highlights list
    const featuresList = document.getElementById('modalProductFeatures');
    featuresList.innerHTML = '';
    const features = Array.isArray(product.features) ? product.features : [];
    features.forEach(f => {
      const li = document.createElement('li');
      li.textContent = f;
      featuresList.appendChild(li);
    });

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // =========================================================
  // Shopping Cart System
  // =========================================================
  loadCart() {
    try {
      const saved = localStorage.getItem('busrify_cart') || localStorage.getItem('lumina_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveCart() {
    localStorage.setItem('busrify_cart', JSON.stringify(this.cart));
    this.renderCart();
  }

  addToCart(product, quantity = 1) {
    const existingIndex = this.cart.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      const newQty = this.cart[existingIndex].quantity + quantity;
      if (newQty > product.stock) {
        this.showToast(`Only ${product.stock} units available in stock.`, 'error');
        return;
      }
      this.cart[existingIndex].quantity = newQty;
    } else {
      if (quantity > product.stock) {
        this.showToast(`Only ${product.stock} units available in stock.`, 'error');
        return;
      }
      this.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity: quantity,
        stock: product.stock
      });
    }

    this.saveCart();
    this.showToast(`Added "${product.name}" to cart!`, 'success');

    // Trigger bounce animation on cart badge
    const badge = document.getElementById('cartCountBadge');
    if (badge) {
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
  }

  updateItemQuantity(productId, change) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    const newQty = item.quantity + change;
    if (newQty <= 0) {
      this.removeItemFromCart(productId);
    } else if (newQty > item.stock) {
      this.showToast(`Max available stock reached (${item.stock})`, 'info');
    } else {
      item.quantity = newQty;
      this.saveCart();
    }
  }

  removeItemFromCart(productId) {
    const item = this.cart.find(i => i.id === productId);
    this.cart = this.cart.filter(i => i.id !== productId);
    this.saveCart();
    if (item) {
      this.showToast(`Removed "${item.name}" from cart`, 'info');
    }
  }

  clearCart() {
    this.cart = [];
    this.appliedPromo = null;
    this.saveCart();
    this.showToast('Shopping cart cleared', 'info');
  }

  renderCart() {
    const countBadge = document.getElementById('cartCountBadge');
    const drawerCount = document.getElementById('cartDrawerCount');
    const itemsList = document.getElementById('cartItemsList');
    const emptyView = document.getElementById('cartEmptyView');
    const footer = document.getElementById('cartFooter');

    const totalCount = this.cart.reduce((sum, i) => sum + i.quantity, 0);
    if (countBadge) countBadge.textContent = totalCount;
    if (drawerCount) drawerCount.textContent = `(${totalCount} ${totalCount === 1 ? 'item' : 'items'})`;

    if (!itemsList) return;

    if (this.cart.length === 0) {
      itemsList.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (emptyView) emptyView.style.display = 'flex';
      return;
    }

    itemsList.style.display = 'flex';
    if (footer) footer.style.display = 'block';
    if (emptyView) emptyView.style.display = 'none';

    itemsList.innerHTML = '';
    let subtotal = 0;

    this.cart.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;

      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.innerHTML = `
        <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${this.formatINR(item.price)}</div>
          <div class="cart-item-controls">
            <div class="qty-stepper">
              <button type="button" class="qty-btn minus-btn" data-id="${item.id}">-</button>
              <span class="qty-val">${item.quantity}</span>
              <button type="button" class="qty-btn plus-btn" data-id="${item.id}">+</button>
            </div>
            <button type="button" class="item-delete-btn" data-id="${item.id}" title="Remove item">&times;</button>
          </div>
        </div>
      `;

      itemEl.querySelector('.minus-btn').addEventListener('click', () => this.updateItemQuantity(item.id, -1));
      itemEl.querySelector('.plus-btn').addEventListener('click', () => this.updateItemQuantity(item.id, 1));
      itemEl.querySelector('.item-delete-btn').addEventListener('click', () => this.removeItemFromCart(item.id));

      itemsList.appendChild(itemEl);
    });

    // Update pricing totals
    let discount = 0;
    if (this.appliedPromo) {
      if (this.appliedPromo.discount) {
        discount = this.appliedPromo.discount;
      }
    }

    const freeShippingThreshold = 1499;
    const isFreeShipping = (subtotal >= freeShippingThreshold) || (this.appliedPromo?.freeShipping);
    const shipping = (subtotal === 0 || isFreeShipping) ? 0 : 99.00;
    const finalTotal = Math.max(0, subtotal + shipping - discount);

    document.getElementById('cartSubtotal').textContent = this.formatINR(subtotal);
    document.getElementById('cartShipping').textContent = shipping === 0 ? 'FREE' : this.formatINR(shipping);
    document.getElementById('cartTotal').textContent = this.formatINR(finalTotal);

    const discountRow = document.getElementById('discountRow');
    if (discountRow) {
      if (discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('discountLabel').textContent = `Discount (${this.appliedPromo.code})`;
        document.getElementById('cartDiscount').textContent = `-${this.formatINR(discount)}`;
      } else {
        discountRow.style.display = 'none';
      }
    }

    // Shipping progress bar
    const progressFill = document.getElementById('shippingProgressFill');
    const progressText = document.getElementById('shippingProgressText');
    if (progressFill && progressText) {
      if (isFreeShipping) {
        progressFill.style.width = '100%';
        progressText.innerHTML = '🎉 You have unlocked <strong>Free Express Shipping</strong>!';
      } else {
        const remaining = freeShippingThreshold - subtotal;
        const pct = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
        progressFill.style.width = `${pct}%`;
        progressText.innerHTML = `Add <strong>${this.formatINR(remaining)}</strong> more for <strong>Free Express Shipping</strong>`;
      }
    }
  }

  openCartDrawer() {
    document.getElementById('cartDrawer')?.classList.add('active');
    document.getElementById('cartOverlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeCartDrawer() {
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.getElementById('cartOverlay')?.classList.remove('active');
    document.body.style.overflow = '';
  }

  async applyPromoCode() {
    const input = document.getElementById('promoInput');
    const msg = document.getElementById('promoMessage');
    const code = input?.value.trim();

    if (!code) {
      if (msg) {
        msg.className = 'promo-msg error';
        msg.textContent = 'Please enter a promotional code';
      }
      return;
    }

    const subtotal = this.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        this.appliedPromo = data;
        if (msg) {
          msg.className = 'promo-msg success';
          msg.textContent = `Applied: ${data.description}`;
        }
        this.renderCart();
        this.showToast(`Promo code "${code.toUpperCase()}" applied!`, 'success');
      } else {
        if (msg) {
          msg.className = 'promo-msg error';
          msg.textContent = data.error || 'Invalid promotional code';
        }
      }
    } catch (err) {
      console.error(err);
      this.showToast('Could not validate promo code', 'error');
    }
  }

  // =========================================================
  // Checkout Wizard & Order Placement
  // =========================================================
  openCheckoutModal() {
    if (this.cart.length === 0) {
      this.showToast('Your cart is empty. Add products before checkout.', 'info');
      return;
    }

    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    // Autofill user details if logged in
    if (this.currentUser) {
      const nameInput = document.getElementById('shipName');
      const emailInput = document.getElementById('shipEmail');
      if (nameInput && !nameInput.value) nameInput.value = this.currentUser.name;
      if (emailInput && !emailInput.value) emailInput.value = this.currentUser.email;
    }

    this.showCheckoutStep(1);
    this.updateCheckoutSummaryPreview();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  showCheckoutStep(stepNumber) {
    const shippingForm = document.getElementById('shippingForm');
    const paymentForm = document.getElementById('paymentForm');
    const successScreen = document.getElementById('orderSuccessScreen');

    const step1 = document.getElementById('stepIndicator1');
    const step2 = document.getElementById('stepIndicator2');
    const step3 = document.getElementById('stepIndicator3');

    // Reset visibility
    if (shippingForm) shippingForm.style.display = 'none';
    if (paymentForm) paymentForm.style.display = 'none';
    if (successScreen) successScreen.style.display = 'none';

    step1.classList.remove('active');
    step2.classList.remove('active');
    step3.classList.remove('active');

    if (stepNumber === 1) {
      if (shippingForm) shippingForm.style.display = 'block';
      step1.classList.add('active');
    } else if (stepNumber === 2) {
      if (paymentForm) paymentForm.style.display = 'block';
      step1.classList.add('active');
      step2.classList.add('active');
      this.updateCheckoutSummaryPreview();
    } else if (stepNumber === 3) {
      if (successScreen) successScreen.style.display = 'block';
      step1.classList.add('active');
      step2.classList.add('active');
      step3.classList.add('active');
    }
  }

  updateCheckoutSummaryPreview() {
    const subtotal = this.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discount = this.appliedPromo?.discount || 0;
    const isFreeShipping = (subtotal >= 1499) || (this.appliedPromo?.freeShipping);
    const shipping = (subtotal === 0 || isFreeShipping) ? 0 : 99.00;
    const total = Math.max(0, subtotal + shipping - discount);

    document.getElementById('checkoutSummarySubtotal').textContent = this.formatINR(subtotal);
    document.getElementById('checkoutSummaryShipping').textContent = shipping === 0 ? 'FREE' : this.formatINR(shipping);
    document.getElementById('checkoutSummaryTotal').textContent = this.formatINR(total);

    const discountRow = document.getElementById('checkoutSummaryDiscountRow');
    if (discountRow) {
      if (discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('checkoutSummaryDiscount').textContent = `-${this.formatINR(discount)}`;
      } else {
        discountRow.style.display = 'none';
      }
    }
  }

  async processOrder() {
    const submitBtn = document.getElementById('submitOrderBtn');
    const spinner = submitBtn?.querySelector('.spinner');

    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    const customerName = document.getElementById('shipName').value.trim();
    const customerEmail = document.getElementById('shipEmail').value.trim();
    const address = {
      street: document.getElementById('shipAddress').value.trim(),
      city: document.getElementById('shipCity').value.trim(),
      state: document.getElementById('shipState').value.trim(),
      zip: document.getElementById('shipZip').value.trim(),
      country: document.getElementById('shipCountry').value
    };

    const selectedPayMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'Credit Card';

    const subtotal = this.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discount = this.appliedPromo?.discount || 0;
    const isFreeShipping = (subtotal >= 1499) || (this.appliedPromo?.freeShipping);
    const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : 99.00;
    const totalAmount = Math.max(0, subtotal + shippingFee - discount);

    const payload = {
      customerName,
      customerEmail,
      shippingAddress: `${address.street}, ${address.city}, ${address.state} ${address.zip}, ${address.country}`,
      items: this.cart,
      subtotal,
      shippingFee,
      discount,
      totalAmount,
      paymentMethod: selectedPayMethod
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete order');
      }

      // Order success!
      this.renderReceipt(data.order, payload);
      this.clearCart();
      this.showCheckoutStep(3);
      this.showToast('Order confirmed! A confirmation email has been sent.', 'success');

      // Refresh product stock counts
      await this.fetchProducts();
    } catch (err) {
      console.error(err);
      this.showToast(err.message, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  }

  renderReceipt(order, payload) {
    document.getElementById('receiptOrderNumber').textContent = order.orderNumber;
    document.getElementById('receiptCustomerName').textContent = payload.customerName;
    document.getElementById('receiptCustomerEmail').textContent = payload.customerEmail;
    document.getElementById('receiptAddress').textContent = payload.shippingAddress;
    document.getElementById('receiptPaymentMethod').textContent = payload.paymentMethod;
    document.getElementById('receiptTotalAmount').textContent = this.formatINR(order.totalAmount);
  }

  // =========================================================
  // User Authentication & Session
  // =========================================================
  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        this.setUser(data.user);
      } else {
        this.setUser(null);
      }
    } catch {
      this.setUser(null);
    }
  }

  setUser(user) {
    this.currentUser = user;
    const label = document.getElementById('userAccountLabel');
    if (label) {
      label.textContent = user ? user.name.split(' ')[0] : 'Sign In';
    }
  }

  openAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    document.getElementById('authErrorMsg').style.display = 'none';
    document.getElementById('registerErrorMsg').style.display = 'none';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  async handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errBanner = document.getElementById('authErrorMsg');

    errBanner.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      this.setUser(data.user);
      this.closeAuthModal();
      this.showToast(`Welcome back, ${data.user.name}!`, 'success');
    } catch (err) {
      errBanner.style.display = 'block';
      errBanner.textContent = err.message;
    }
  }

  async handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errBanner = document.getElementById('registerErrorMsg');

    errBanner.style.display = 'none';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      this.setUser(data.user);
      this.closeAuthModal();
      this.showToast(`Account created! Welcome, ${data.user.name}!`, 'success');
    } catch (err) {
      errBanner.style.display = 'block';
      errBanner.textContent = err.message;
    }
  }

  async handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      this.setUser(null);
      this.closeProfileModal();
      this.showToast('You have been signed out', 'info');
    } catch (err) {
      console.error(err);
    }
  }

  // =========================================================
  // User Profile & Order History Modal
  // =========================================================
  async openProfileModal() {
    if (!this.currentUser) return;
    const modal = document.getElementById('profileModal');
    if (!modal) return;

    document.getElementById('profileName').textContent = this.currentUser.name;
    document.getElementById('profileEmail').textContent = this.currentUser.email;
    const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('profileAvatar').textContent = initials;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    await this.fetchUserOrders();
  }

  closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  async fetchUserOrders() {
    const list = document.getElementById('orderHistoryList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Loading past orders...</div>';

    try {
      const res = await fetch('/api/orders/my-orders');
      if (!res.ok) throw new Error('Failed to load orders');

      const data = await res.json();
      const orders = data.orders || [];

      if (orders.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding: 40px 20px;">
            <div style="font-size:2.4rem; margin-bottom:10px;">📦</div>
            <h4>No orders yet</h4>
            <p style="color:var(--text-secondary); font-size:0.9rem;">Once you place an order, it will appear here with live tracking.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = '';
      orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-history-card';

        const itemsHtml = (order.items || []).map(item => `
          <div class="order-history-item-row">
            <span>${item.product_name} <strong>x${item.quantity}</strong></span>
            <span>${this.formatINR(item.price * item.quantity)}</span>
          </div>
        `).join('');

        const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        card.innerHTML = `
          <div class="order-card-header">
            <div>
              <span class="order-card-num">${order.order_number}</span>
              <span style="font-size:0.8rem; color:var(--text-muted); margin-left:8px;">${formattedDate}</span>
            </div>
            <span class="order-badge status-processing">${order.status}</span>
          </div>
          <div class="order-card-items-preview">
            ${itemsHtml}
          </div>
          <div class="order-card-footer">
            <span style="font-size:0.82rem; color:var(--text-muted);">${order.items?.length || 0} items · Paid with ${order.payment_method}</span>
            <strong>Total: ${this.formatINR(order.total_amount)}</strong>
          </div>
        `;

        list.appendChild(card);
      });
    } catch (err) {
      list.innerHTML = '<div style="color:var(--accent-rose); padding:10px;">Unable to load order history.</div>';
    }
  }

  // =========================================================
  // Toast Notifications
  // =========================================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✨';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(120%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Instantiate BusrifyStore on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BusrifyStore();
});
