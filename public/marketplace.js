// -------------------- Tabs --------------------
function showSection(tabName) {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));

  const idMap = { selling: "sell-items", cart: "my-cart", search: "search" };
  const panelId = idMap[tabName];
  if (panelId) document.getElementById(panelId).classList.add("active");

  if (tabName === "selling") document.querySelector(".tab:nth-child(1)").classList.add("active");
  else if (tabName === "cart") document.querySelector(".tab:nth-child(2)").classList.add("active");
  else if (tabName === "search") document.querySelector(".tab:nth-child(3)").classList.add("active");

  if (tabName === "selling") loadMyItems();
  if (tabName === "cart") loadCartItems();
}

// -------------------- Toggle Listing Form --------------------
const toggleListingBtn = document.getElementById("toggleListingBtn");
const createList = document.getElementById("createList");

toggleListingBtn.addEventListener("click", () => {
  createList.style.display = createList.style.display === "none" ? "block" : "none";
});

// -------------------- Load Seller Items --------------------
async function loadMyItems() {
  const container = document.getElementById("seller-items");
  container.innerHTML = "<p>Loading your items...</p>";

  try {
    const res = await fetch("/items/mine");
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    const items = await res.json();
    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = "<p>You have not listed any items yet.</p>";
      return;
    }

    for (const item of items) {
      const card = document.createElement("div");
      card.classList.add("myItem-card");

      const imgHTML = item.images && item.images.length
        ? `<img src="${item.images[0]}" alt="${item.name}" class="item-thumb">`
        : `<img src="placeholder.png" alt="No image" class="item-thumb">`;

      card.innerHTML = `
        <div class="itemCard-container">
          ${imgHTML}
          <div class="item-details">
            <h3>${item.name}</h3>
            <p><b>Code: </b>${item.productCode}</p>
            <p><b>Quantity: </b>${item.quantity}</p>
            <p><b>Description: </b>${item.description}</p>
            <div class="seller-details">
              <a href="viewusers.html#${item.seller?.userId || ""}" class="seller-link">
                <img src="${item.seller?.userId ? `/api/profile-photo/${item.seller.userId}` : 'default-avatar.png'}" alt="profile photo" id="seller-profile-photo">
                <h4 class="seller-name">
                  ${item.seller?.firstName || "Unknown"} ${item.seller?.lastName || ""}
                </h4>
              </a>
              <p id="seller-address"></p>
            </div>
          </div>
          <div class="right-box">
            <div class="iconAndPrice">
              <img src="1731566.png" alt="priceTag" class="priceTag-icon">
              <h3 class="price-tag">R${Number(item.price).toFixed(2)}</h3>
            </div>
            <button class="delete-item-btn" data-id="${item._id}">
              <img src="123000.png" alt="bin icon" class="binIcon">
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);
    }

    // Attach delete events
    document.querySelectorAll(".delete-item-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.id;

      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Failed to load your items.</p>";
  }
}

// -------------------- CART STATE --------------------
let cartMap = new Map(); // global state for instant sync

// Fetch cart items from server
async function getCart() {
  try {
    const res = await fetch("/api/cart");
    if (res.status === 401) {
      window.location.href = "/login.html";
      return [];
    }
    const cart = await res.json();
    cartMap = new Map(cart.map(ci => [ci.productCode, ci])); // update global state
    return cart;
  } catch (err) {
    console.error("Get cart error:", err);
    return [];
  }
}

// ✅ Add item to cart
async function addToCart(productCode, quantity = 1) {
  try {
    const res = await fetch("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productCode, quantity }),
    });

    if (!res.ok) throw new Error("Failed to add item");

    await getCart(); // refresh global cart state
    await loadCartItems(); // refresh cart tab
    updateSearchButtons(); // refresh search tab instantly
  } catch (err) {
    console.error("Error adding to cart:", err);
    alert("Error adding to cart");
  }
}

// ✅ Remove item from cart
async function removeFromCart(productCode) {
  try {
    const res = await fetch("/api/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productCode }),
    });

    if (!res.ok) throw new Error("Failed to remove item");

    await getCart();
    await loadCartItems();
    updateSearchButtons();
  } catch (err) {
    console.error("Error removing from cart:", err);
  }
}

// -------------------- Search Items --------------------
document.getElementById("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = document.getElementById("search-input").value.trim();
  if (!code) return;

  const container = document.getElementById("search-results");
  container.innerHTML = "<p>Searching...</p>";

  try {
    const res = await fetch(`/items/search?code=${encodeURIComponent(code)}`);
    const items = await res.json();
    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = "<p>No items found.</p>";
      return;
    }

    await getCart(); // refresh cartMap

    for (const item of items) {
      const card = document.createElement("div");
      card.classList.add("searchItem-card");

      const imgHTML = item.images && item.images.length
        ? `<img src="${item.images[0]}" alt="${item.name}" class="item-thumb">`
        : `<img src="placeholder.png" alt="No image" class="item-thumb">`;

      const inCart = cartMap.has(item.productCode);

      card.innerHTML = `
        <div class="itemCard-container">
          ${imgHTML}
          <div class="item-details">
            <h3>${item.name}</h3>
            <p><b>Code: </b>${item.productCode}</p>
            <p><b>Available: </b>${item.quantity}</p>
            <p><b>Description: </b>${item.description}</p>
            <div class="seller-details">
              <a href="viewusers.html#${item.seller?.userId || ""}" class="seller-link">
                <img src="${item.seller?.userId ? `/api/profile-photo/${item.seller.userId}` : 'default-avatar.png'}" alt="profile photo" id="seller-profile-photo">
                <h4 class="seller-name">
                  ${item.seller?.firstName || "Unknown"} ${item.seller?.lastName || ""}
                </h4>
              </a>
              <p id="seller-address"></p>
            </div>
          </div>
          <div class="right-box">
            <div class="iconAndPrice">
              <img src="1731566.png" alt="priceTag" class="priceTag-icon">
              <h3 class="price-tag">R${Number(item.price).toFixed(2)}</h3>
            </div>
            <div class="add-removeCart">
              <label class="status-label">${inCart ? "In Cart" : "Not in Cart"}</label>
              <button class="cart-btn" data-code="${item.productCode}">
                ${inCart ? "🗑 Remove" : "🛒 Add"}
              </button>
            </div>
          </div>
        </div>
      `;

      container.appendChild(card);

      const btn = card.querySelector(".cart-btn");
      btn.addEventListener("click", async () => {
        if (cartMap.has(item.productCode)) {
          await removeFromCart(item.productCode);
        } else {
          await addToCart(item.productCode);
        }
      });
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Search failed.</p>";
  }
});

// -------------------- Update Search Buttons Globally --------------------
function updateSearchButtons() {
  document.querySelectorAll(".searchItem-card").forEach(card => {
    const code = card.querySelector(".cart-btn").dataset.code;
    const btn = card.querySelector(".cart-btn");
    const statusLabel = card.querySelector(".status-label");

    if (cartMap.has(code)) {
      btn.textContent = "🗑 Remove";
      statusLabel.textContent = "In Cart";
    } else {
      btn.textContent = "🛒 Add";
      statusLabel.textContent = "Not in Cart";
    }
  });
}

// -------------------- My Cart Tab --------------------
async function loadCartItems() {
  const container = document.getElementById("added-items");
  const footer = document.getElementById("cart-footer");
  const totalDisplay = document.getElementById("cart-total");

  container.innerHTML = "<p>Loading your cart...</p>";

  const cart = await getCart();
  container.innerHTML = "";

  if (!cart.length) {
    container.innerHTML = "<p>No items yet in cart.</p>";
    footer.classList.add("hidden"); // hide footer if empty
    return;
  }

  let totalCost = 0;

  for (const item of cart) {
    // ✅ default price full unless adjusted by radio
    let displayPrice = Number(item.price);
    totalCost += displayPrice * (item.quantity || 1);

    const card = document.createElement("div");
    card.classList.add("cartItem-card");

    const imgHTML = item.images && item.images.length
      ? `<img src="${item.images[0]}" width="100" class="item-thumb">`
      : `<img src="placeholder.png" width="100">`;

    // ✅ Radios
    let purchaseOptionsHTML = "";
    if (Number(item.price) > 4000) {
      purchaseOptionsHTML = `
        <div class="purchase-options">
          <input type="radio" name="purchaseOption-${item.productCode}" value="purchase" checked>
          <label>Purchase anyway (100%)</label>
        </div>
        <div class="purchase-options">
          <input type="radio" name="purchaseOption-${item.productCode}" value="test">
          <label>Test product first (50% deposit)</label>
        </div>
        
      `;
    }

    card.innerHTML = `
      <div class="itemCard-container">
        ${imgHTML}
        <div class="item-details">
          <h3>${item.name}</h3>
          <p><b>Code: </b>${item.productCode}</p>
          <p><b>Quantity: </b>${item.quantity}</p>
          <p><b>Description: </b>${item.description || "No description"}</p>
          <a href="information.html#testFeature" id="infoLinks">test feature?</a>
          <div class="seller-details">
            <a href="viewusers.html#${item.seller?.userId || ""}" class="seller-link">
              <img src="${item.seller?.userId ? `/api/profile-photo/${item.seller.userId}` : 'default-avatar.png'}" alt="profile photo" id="seller-profile-photo">
              <h4 class="seller-name">
                ${item.seller?.firstName || "Unknown"} ${item.seller?.lastName || ""}
              </h4>
            </a>
          </div>
          ${purchaseOptionsHTML}
        </div>
        <div class="right-box">
          <div class="iconAndPrice">
            <img src="1731566.png" alt="priceTag" class="priceTag-icon">
            <h3 class="price-tag" data-base="${item.price}">R${displayPrice.toFixed(2)}</h3>
          </div>
          <button class="remove-cart-btn" data-id="${item._id}">
            Remove
            <img src="123000.png" alt="bin icon" class="binIcon">
          </button>
        </div>          
      </div>
    `;

    container.appendChild(card);

    // ✅ Radio event to update price immediately
    card.querySelectorAll(`input[name="purchaseOption-${item.productCode}"]`).forEach(radio => {
      radio.addEventListener("change", () => {
        const priceTag = card.querySelector(".price-tag");
        const base = Number(priceTag.dataset.base);
        let newPrice = base;

        if (radio.value === "test") {
          newPrice = base * 0.5;
        }

        priceTag.textContent = `R${newPrice.toFixed(2)}`;
        recalcTotal();
      });
    });

    // remove event
    card.querySelector(".remove-cart-btn").addEventListener("click", async () => {
      await removeFromCart(item.productCode);
      await loadCartItems();
    });
  }

  // ✅ Update total & show footer
  recalcTotal();
  footer.classList.remove("hidden");

  function recalcTotal() {
    let sum = 0;
    document.querySelectorAll(".cartItem-card").forEach(card => {
      const priceTag = card.querySelector(".price-tag");
      const qty = 1; // if you support quantity later, update this
      const val = Number(priceTag.textContent.replace("R", "")) || 0;
      sum += val * qty;
    });
    totalDisplay.textContent = `Total: R${sum.toFixed(2)}`;
  }
}

// === Proceed to Checkout ===
const proceedBtn = document.getElementById("proceed-to-checkout-btn");
if (proceedBtn) {
  proceedBtn.addEventListener("click", async () => {
    try {
      // 1. Get current cart from backend
      const cartRes = await fetch("/api/cart/get");
      if (!cartRes.ok) throw new Error("Failed to fetch cart");
      const cart = await cartRes.json();

      if (!cart || cart.length === 0) {
        alert("Your cart is empty.");
        return;
      }

      // 2. Group items by seller
      // 2. Group items by seller
const grouped = {};
document.querySelectorAll(".cartItem-card").forEach(card => {
  const sellerId = card.querySelector(".seller-link")?.getAttribute("href")?.replace("viewusers.html#", "");
  if (!sellerId) return;

  const productCode = card.querySelector(".item-details p b")?.innerText || "";
  const name = card.querySelector(".item-details h3")?.innerText || "";
  const qty = 1; // adjust if you later support multiple quantities
  const updatedPrice = Number(card.querySelector(".price-tag").textContent.replace("R", "")) || 0;

  if (!grouped[sellerId]) {
    grouped[sellerId] = {
      sellerId,
      items: []
    };
  }

  grouped[sellerId].items.push({
    productCode,
    name,
    updatedPrice,  // ✅ now sends the adjusted price
    quantity: qty
  });
});

const sellers = Object.values(grouped);
      console.log("Proceed checkout payload:", { sellers });

      // 3. Send payload to create checkout in DB
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellers })
      });

      if (!res.ok) {
        const errMsg = await res.text();
        throw new Error(errMsg || "Failed to create checkout");
      }

      const data = await res.json();
      console.log("Checkout created:", data);

      // 4. Redirect to checkout page
      window.location.href = "/checkout.html";
    } catch (err) {
      console.error("Error creating checkout:", err);
    }
  });
}

// -------------------- Initialize --------------------
document.addEventListener("DOMContentLoaded", () => {
  showSection("selling"); // default tab
  loadCartItems();
});