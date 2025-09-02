// ✅ checkout.js
// Fetch seller public info (uses existing endpoint that returns address)
async function getSellerInfo(userId) {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("getSellerInfo error:", err);
    return null;
  }
}


// Show confirmation step and clear payment options
function showConfirmation(order) {
  const stepsContainer = document.querySelector(".checkout-steps");
  if (!stepsContainer) return; // safety guard

  stepsContainer.innerHTML = `
    <h2>Confirmation</h2>
    ${
      order.orderStatus
        ? `<p>✅ Order Approved. Ready for shipping!</p>`
        : `<p>⏳ Payment under review...</p>
           <p>Your payment proof has been submitted. Please wait for admin approval.</p>`
    }
  `;
  // Clear payment cards if they exist
  const paymentCards = document.querySelector(".payment-cards");
  if (paymentCards) paymentCards.innerHTML = "";
}


// Fallback if no active order found → resume normal checkout steps

function unlockCheckoutSteps() {
  const stepsContainer = document.querySelector(".checkout-steps");
  if (stepsContainer) {
    stepsContainer.innerHTML = `
      <h2>Step 1: Delivery</h2>
      <p>Continue your checkout process...</p>
    `;
  }
}

// Escape HTML for safety
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Calculate delivery fee
// -------------------- DELIVERY COST (RANGE) --------------------
function getDeliveryCost(type, dist) {
  if (typeof dist !== "number" || isNaN(dist)) return 0;

  let cost = 0;

  if (type === "sameday") {
    cost = dist * 4.8; // rate per km
    cost = Math.max(360, Math.min(cost, 480)); // clamp range
  } else if (type === "standard") {
    cost = dist * 3;
    cost = Math.max(250, Math.min(cost, 360));
  } else if (type === "pickup") {
    cost = 0;
  }

  return parseFloat(cost.toFixed(2));
}

// -------------------- GRAND TOTAL --------------------
// -------------------- GRAND TOTAL --------------------
function calculateGrandTotal() {
  const grandTotalEls = document.querySelectorAll("#grand-total");
  if (!grandTotalEls) return;

  let itemTotal = 0;
  let deliveryTotal = 0;

  // Sum item totals
  document.querySelectorAll("#pay-items .payment-card").forEach((card) => {
    const totalText = card.querySelector("h4:last-of-type")?.textContent || "0";
    const total = parseFloat(totalText.replace(/[^0-9.]/g, "")) || 0;
    itemTotal += total;
  });

  // Sum delivery totals
  document.querySelectorAll("#pay-deliveries .payment-delivery").forEach((card) => {
    const costText = card.querySelector(".costprice h4")?.textContent || "0";
    const cost = parseFloat(costText.replace(/[^0-9.]/g, "")) || 0;
    deliveryTotal += cost;
  });

  window.grandTotal = itemTotal + deliveryTotal;

  // Update all total labels
  grandTotalEls.forEach((el) => {
    el.textContent = `Total: R${window.grandTotal.toFixed(2)}`;
  });

  const cardAmountEl = document.getElementById("card-amount");
  if (cardAmountEl) cardAmountEl.textContent = `R${window.grandTotal.toFixed(2)}`;

  // Apply 15% Binance discount
  const discount = window.grandTotal * 0.15;
  const finalAmount = window.grandTotal - discount;

  const costEl = document.getElementById("cost-amount");
  const discountEl = document.getElementById("discount-amount");
  const finalEl = document.getElementById("final-amount");

  if (costEl && discountEl && finalEl) {
    costEl.textContent = `Original: R${window.grandTotal.toFixed(2)}`;
    discountEl.textContent = `Discount (15%): -R${discount.toFixed(2)}`;
    finalEl.textContent = `Final: R${finalAmount.toFixed(2)}`;
  }
}
// -------------------- INJECT SELECTED DELIVERIES --------------------
function injectSelectedDeliveries(checkout) {
  const container = document.getElementById("pay-deliveries");
  if (!container) return;

  container.innerHTML = "";
  const sellers = checkout?.checkout?.sellers || checkout?.sellers || [];

  sellers.forEach((seller) => {
    const selectedRadio = document.querySelector(
      `input[name="delivery-${seller.sellerId}"]:checked`
    );
    if (!selectedRadio) return;

    const card =
      selectedRadio.closest(".delivery-card-sameday") ||
      selectedRadio.closest(".delivery-card-standard") ||
      selectedRadio.closest(".delivery-card-pickup");

    if (!card) return;

    const clone = card.cloneNode(true);
    clone.querySelectorAll("input").forEach((el) => el.remove());

    container.innerHTML += `<div class="payment-delivery">${clone.outerHTML}</div>`;
  });
}

// -------------------- MAIN DOMCONTENTLOADED --------------------
document.addEventListener("DOMContentLoaded", async () => {
  // --- Order check ---
  try {
    const res = await fetch("/api/orders/my");
    if (res.ok) {
      const data = await res.json();

      if (data.success && data.order) {
  window.currentOrder = data.order;

  // Use checkoutSnapshot instead of DOM elements
  const order = data.order;
  const snapshot = order.checkoutSnapshot;
    if (snapshot && Array.isArray(snapshot.sellers)) {
      // Render items summary
      const paymentItemsDiv = document.getElementById("pay-items");
      if (paymentItemsDiv) {
        paymentItemsDiv.innerHTML = snapshot.sellers
          .flatMap(seller => 
            (seller.items || []).map(it => {
              const price = Number(it.updatedPrice || it.price || 0);
              const total = (price * (it.quantity || 1)).toFixed(2);
              const imageSrc = it.image || "placeholder.png";
              return `
              <div class="payment-card">
                <div class="item-img">
                  <img src="${imageSrc}" alt="${escapeHtml(it.name)}" onerror="this.src='placeholder.png'"/>
                </div>
                <div class="column-cont">
                  <div class="item-row">
                    <div></div>
                    <div class="item-info">
                      <h4>${escapeHtml(it.name)}</h4>
                      <p><b>Quantity:</b> ${it.quantity}</p>
                      <p><b>Price:</b> R${price.toFixed(2)}</p>
                      <h4 id="item-total"><b>Total:</b> R${total}</h4>
                    </div>
                  </div>
                </div>
              </div>`;
            })
          ).join("");
      }

      // Render delivery selections
      if (deliveryOptions) {
        deliveryOptions.innerHTML = "";
        snapshot.sellers.forEach(seller => {
          const dist = seller.distance || 0;
          const selected = seller.selectedDelivery || "standard";

          const sameDayCost = getDeliveryCost("sameday", dist);
          const standardCost = getDeliveryCost("standard", dist);
          const pickupCost = getDeliveryCost("pickup", dist);

          deliveryOptions.innerHTML += `
            <div class="seller-delivery-group" data-seller="${seller.sellerId}">
              ${renderDeliveryCard("sameday", "Same-day delivery", dist, 4.8, sameDayCost, "truck_808710.png", "", seller.sellerId, selected === "sameday")}
              ${renderDeliveryCard("standard", "Standard delivery", dist, 3, standardCost, "truck_808710.png", "", seller.sellerId, selected === "standard")}
              ${renderDeliveryCard("pickup", "Pick-up", dist, 0, pickupCost, "12875406.png", "", seller.sellerId, selected === "pickup")}
            </div>
          `;
        });
      }
    }

    // Show confirmation step if order is already approved
    if (order.orderStatus) showConfirmation(order);
  } else {
    unlockCheckoutSteps();
  }
    } else {
      unlockCheckoutSteps();
    }
  } catch (err) {
    console.error("Error checking order:", err);
    unlockCheckoutSteps();
    }


  const deliveryOptionsDiv = document.getElementById("deliveryOptions");
  const paymentItemsDiv = document.getElementById("pay-items");

  try {
    // Fetch buyer
    const buyerRes = await fetch("/api/me");
    if (!buyerRes.ok) throw new Error("Failed to fetch buyer info");
    const buyer = await buyerRes.json();
    if (!buyer?.droppedPin) throw new Error("Buyer droppedPin missing");
    const buyerPin = buyer.droppedPin;

    // Fetch checkout
    const res = await fetch("/api/checkout/get");
    if (!res.ok) throw new Error("No active checkout found");
    const checkout = await res.json();
    window.globalCheckout = checkout;

    if (!checkout?.checkout?.sellers?.length) {
      deliveryOptionsDiv.innerHTML = "<p>Your checkout is empty.</p>";
      paymentItemsDiv.innerHTML = "<p>No items found in checkout.</p>";
      return;
    }
    window.paymentUnderReview = false;
    window.orderApproved = false;
    window.currentOrder = null;

    // -------------------- RENDER DELIVERY OPTIONS --------------------
    deliveryOptionsDiv.innerHTML = "";
    checkout.checkout.sellers.forEach((seller) => {
  const sellerPin = seller.sellerDroppedPin;
  if (!sellerPin) {
    deliveryOptionsDiv.innerHTML += `
      <div class="seller-delivery-group">
        <p style="color:red">Cannot calculate distance: Seller droppedPin missing.</p>
      </div>`;
    return;
  }

  const dist = calculateDistance(
    Number(buyerPin.lat),
    Number(buyerPin.lon),
    Number(sellerPin.lat),
    Number(sellerPin.lon)
  );

  const sameDayCost = getDeliveryCost("sameday", dist);
  const standardCost = getDeliveryCost("standard", dist);
  const pickupCost = getDeliveryCost("pickup", dist);

  deliveryOptionsDiv.innerHTML += `
    <div class="seller-delivery-group" data-seller="${seller.sellerId}">

      ${renderDeliveryCard(
        "sameday",
        "Same-day delivery",
        dist,
        4.8, // rate per km display
        sameDayCost,
        "truck_808710.png",
        "Any request after 17:00 will be completed the next day.<br>Reliable same-day delivery for your convenience.",
        seller.sellerId,
        true
      )}

      ${renderDeliveryCard(
        "standard",
        "Standard delivery",
        dist,
        3,
        standardCost,
        "truck_808710.png",
        "About 3-5 days.<br>Affordable and reliable standard delivery service.",
        seller.sellerId
      )}

      ${renderDeliveryCard(
        "pickup",
        "Pick-up",
        dist,
        0,
        pickupCost,
        "12875406.png",
        "Pick-up within 7 days — secure and hassle-free.<br>Scheduled to suit you.",
        seller.sellerId
      )}
    </div>`;
});

    // Fetch seller addresses
    const sellerEls = Array.from(document.querySelectorAll(".seller-address"));
    const sellerIds = [...new Set(sellerEls.map((el) => el.dataset.seller).filter(Boolean))];
    await Promise.all(
      sellerIds.map(async (sid) => {
        try {
          const info = await getSellerInfo(sid);
          const address = info?.address || "Address not available";
          document.querySelectorAll(`.seller-address[data-seller="${sid}"]`).forEach((el) => {
            el.textContent = address;
          });
        } catch (err) {
          console.error("Address fetch failed for", sid, err);
          document.querySelectorAll(`.seller-address[data-seller="${sid}"]`).forEach((el) => {
            el.textContent = "Address not available";
          });
        }
      })
    );

    // -------------------- RENDER PAYMENT ITEMS --------------------
    const allItems = checkout.checkout.sellers.flatMap((seller) =>
      seller.items.map((item) => ({ ...item, sellerId: seller.sellerId }))
    );

    paymentItemsDiv.innerHTML = allItems
      .map((item) => {
        const imageSrc = item.image || "placeholder.png";
        const total = (Number(item.updatedPrice) * Number(item.quantity || 1)).toFixed(2);
        return `
        <div class="payment-card">
          <div class="column-cont">
            <div class="item-row">
              <div></div>
              <div class="item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p><b>Quantity:</b> ${item.quantity}</p>
                <p><b>Price:</b> R${Number(item.updatedPrice).toFixed(2)}</p>
                <h4 id="item-total"><b>Total:</b> R${total}</h4>
              </div>
            </div>
            <div class="description">
              <p>
                After completing your purchase, SafeMark will immediately issue you an official <b>Ownership Transfer Certificate.</b>
                <br> <a href="information.html#ootc" id="ootcLink">Learn More...</a>
              </p>
            </div>
          </div>
        </div>`;
      })
      .join("");

    injectSelectedDeliveries(checkout);
    calculateGrandTotal();

    // -------------------- INJECT PAYMENT CARDS --------------------
    const paymentCardsDiv = document.querySelector(".payment-cards");
    if (paymentCardsDiv) {
      paymentCardsDiv.innerHTML = `
        <h3 id="methods">Payment methods:</h3>
        <div class="card-with-discount">
          <h3>Binance Pay (recommendend<a href="information.html#binancePay" id="infoLinks"> Why it?</a>)<img src="3246711.png" alt="binance icon"></h3>
          <h5>Pay securely with Binance on SafeMark and enjoy an exclusive 15% discount.</h5>
          <div class="benefits-BNB">
            <details>
              <summary>Advantages:</summary>
              <li><b>Exclusive 15% Discount</b> - Save instantly when you choose Binance as your payment method.</li>
              <li><b>Fast & Secure Transactions</b> - Enjoy near-instant confirmations with blockchain-level security.</li>
              <li><b>Refundable Protection</b> - Eligible payments are covered by SafeMark's refund policy for added peace of mind.</li>
            </details>
          </div>
          <div class="amount-section">
            <p id="cost-amount"></p>
            <p id="discount-amount"></p>
            <h3 id="final-amount"></h3>
          </div>
          <div class="safemark-details">
            <h4 id="pay-heading">Payment details:</h4>
            <div class="bnb-details">
              <h4>Binance ID: 1079187985</h4>
              <button>Scan QR Code</button>
            </div>
          </div>
          <div class="uploadPayment">
            <h3>Upload proof of payment:</h3>
            <div class="paymentproof">
              <input type="file"><button type="submit" id="proof-of-payment"><img src="745052.png" alt="upload" id="upload-proof"></button>
            </div>
          </div>
        </div>

        <div class="cardPayment">
          <div class="icon-logos">
            <img src="1592515.png" alt="logos">
            <img src="158822.png" alt="logos">
            <img src="1592497.png" alt="logos">
            <img src="1592484.png" alt="logos">
            <img src="1592479.png" alt="logos">
            <img src="1592515.png" alt="logos">
          </div>
          <div class="banking-details">
            <div class="card-number">
              <p>Card Number:</p>
              <input type="text" name="card-number" placeholder="0000 0000 0000 0000">
            </div>
            <div class="exp-csc">
              <div class="expiration">
                <p>expiration Date:</p>
                <input type="text" placeholder="mm / yyyy">
              </div>
              <div class="csc">
                <div class="card-security">
                  <p>Card Security Code:</p>
                  <input type="text" placeholder="0000">
                </div>
                <div class="card-icon">
                  <img src="3503359.png" alt="card icon" id="card-icon">
                </div>
              </div>     
            </div>
            <div class="amount">
              <p>Amount:</p>
              <h3 id="card-amount">R5,000</h3>
            </div>
            <button>pay now</button>
          </div>
        </div>
      `;
    }

    // -------------------- PAYMENT PROOF --------------------
    document.getElementById("proof-of-payment")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const fileInput = document.querySelector(".paymentproof input[type='file']");
  const file = fileInput?.files[0];
  // Prepare form data
  const formData = new FormData();
  formData.append("proof", file);
  formData.append("amount", window.grandTotal);
  formData.append("method", "Binance Pay");
  formData.append("checkoutSnapshot", JSON.stringify(window.globalCheckout)); // <-- new
  formData.append("deliverySelections", JSON.stringify(
    window.globalCheckout.checkout.sellers.map(s => {
      const selectedRadio = document.querySelector(`input[name="delivery-${s.sellerId}"]:checked`);
      return {
        sellerId: s.sellerId,
        selectedDelivery: selectedRadio?.value || null
      };
    })
  )); // <-- new

  try {
    const res = await fetch("/api/payments/upload-proof", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok);

    window.paymentUnderReview = true;
    fileInput.value = "";

    // Update UI
    const paymentCardsDiv = document.querySelector(".payment-cards");
    if (paymentCardsDiv) {
      paymentCardsDiv.innerHTML = `
        <h3>Payment under review...</h3>
        <p>Your payment proof has been submitted. SafeMark admin will review and approve it shortly.</p>
      `;
    }

    document.querySelectorAll(".step1, .step2, .step3").forEach(step => step.classList.remove("active"));
    document.getElementById("confirmation-section").classList.add("active");

  } catch (err) {
    console.error(err);

  }
});

    // -------------------- RADIO CHANGE LISTENER --------------------
    document.addEventListener("change", (e) => {
      if (e.target.matches("[name^='delivery-']")) {
        injectSelectedDeliveries(window.globalCheckout);
        calculateGrandTotal();
      }
    });

    // Poll for admin approval every 5 seconds
    setInterval(() => {
      if (window.paymentUnderReview && !window.orderApproved) {
        refreshOrderStatus();
      }
    }, 5000);

    // -------------------- STEP NAVIGATION --------------------
    initSteps();

  } catch (err) {
    console.error("Checkout load error:", err);
    if (deliveryOptionsDiv) deliveryOptionsDiv.innerHTML = `<p style='color:red'>${err.message}</p>`;
    if (paymentItemsDiv) paymentItemsDiv.innerHTML = `<p style='color:red'>${err.message}</p>`;
  }
});

// -------------------- DELIVERY CARD RENDER HELPER --------------------
function renderDeliveryCard(type, title, dist, fee, cost, icon, description, sellerId, checked = false) {
  return `
    <div class="delivery-card-${type}">
      <label>
        <input type="radio" name="delivery-${sellerId}" value="${type}" ${checked ? "checked" : ""}>
        <h3>${title}</h3>
      </label>
      <div class="row-container">
        <div class="left-cont"><img src="${icon}" class="card-icon"></div>
        <div class="costprice">
          <p><b>distance:</b> ${dist} km</p>
          <p><b>fee:</b> R${fee}/km</p>
          <h4>cost: R${cost}</h4>
        </div>
      </div>
      <div class="card-description">
        <p>${description}</p>
        ${type === "pickup" ? `<p><b>Address:</b></p><p class="seller-address" data-seller="${sellerId}">Loading address...</p>` : ""}
      </div>
    </div>`;
}
// ✅ Inject payment cards dynamically (safe: only populate if empty)
const paymentCardsDiv = document.querySelector(".payment-cards");
if (paymentCardsDiv && paymentCardsDiv.innerHTML.trim() === "") {
  paymentCardsDiv.innerHTML = `
    <h3 id="methods">Payment methods:</h3>
    <div class="card-with-discount">
      <h3>Binance Pay(recommendend)<img src="3246711.png" alt="binance icon"></h3>
      <h5>Pay securely with Binance on SafeMark and enjoy an exclusive 15% discount.</h5>
      <div class="benefits-BNB">
        <details>
          <summary>Advantages:</summary>
          <li><b>Exclusive 15% Discount</b> - Save instantly when you choose Binance as your payment method.</li>
          <li><b>Fast & Secure Transactions</b> - Enjoy near-instant confirmations with blockchain-level security.</li>
          <li><b>Refundable Protection</b> - Eligible payments are covered by SafeMark's refund policy for added peace of mind.</li>
        </details>
      </div>
      <div class="amount-section">
        <p id="cost-amount"></p>
        <p id="discount-amount"></p>
        <h3 id="final-amount"></h3>
      </div>
      <div class="safemark-details">
        <h4 id="pay-heading">Payment details:</h4>
        <div class="bnb-details">
          <h4>Binance ID: 107 918 798 5</h4>
          <button>Scan QR Code</button>
        </div>
      </div>
      <div class="uploadPayment">
        <h3>Upload proof of payment:</h3>
        <div class="paymentproof">
          <input type="file"><button type="submit" id="proof-of-payment"><img src="745052.png" alt="upload" id="upload-proof"></button>
        </div>
      </div>
    </div>

    <div class="cardPayment">
      <div class="icon-logos">
        <img src="1592515.png" alt="logos">
        <img src="158822.png" alt="logos">
        <img src="1592497.png" alt="logos">
        <img src="1592484.png" alt="logos">
        <img src="1592479.png" alt="logos">
        <img src="1592515.png" alt="logos">
      </div>
      <div class="banking-details">
        <div class="card-number">
          <p>Card Number:</p>
          <input type="text" name="card-number" placeholder="0000 0000 0000 0000">
        </div>
        <div class="exp-csc">
          <div class="expiration">
            <p>expiration Date:</p>
            <input type="text" placeholder="mm / yyyy">
          </div>
          <div class="csc">
            <div class="card-security">
              <p>Card Security Code:</p>
              <input type="text" placeholder="0000">
            </div>
            <div class="card-icon">
              <img src="3503359.png" alt="card icon" id="card-icon">
            </div>
          </div>     
        </div>
        <div class="amount">
          <p>Amount:</p>
          <h3 id="card-amount">R5,000</h3>
        </div>
        <button>pay now</button>
      </div>
    </div>
  `;
}

async function refreshOrderStatus() {
  try {
    if (!window.currentOrder && !window.paymentUnderReview) return;

    const res = await fetch("/api/orders/my");
    if (!res.ok) return;
    const order = await res.json();

    // guard in case snapshot missing
    if (!order) return;
    if (!order.checkoutSnapshot || !Array.isArray(order.checkoutSnapshot.sellers)) return;

    if (order?.orderStatus) {
      window.orderApproved = true;
      window.currentOrder = order;

      // Display order summary in confirmation step
      const paymentCardsDiv = document.querySelector(".payment-cards");
      if (paymentCardsDiv) {
        // use updatedPrice from snapshot items if available, fallback to price
        const itemsHtml = order.checkoutSnapshot.sellers
          .flatMap((seller) =>
            (seller.items || []).map((it) => {
              const price = (typeof it.updatedPrice === "number" ? it.updatedPrice : (typeof it.price === "number" ? it.price : 0));
              return `<li>${it.quantity} x ${escapeHtml(it.name || "")} - R${price.toFixed(2)}</li>`;
            })
          )
          .join("");

        paymentCardsDiv.innerHTML = `
          <h3>Order Approved ✅</h3>
          <p>Here is your order summary:</p>
          <ul>${itemsHtml}</ul>
          <p><b>Total Paid:</b> R${(order.totalAmount || 0).toFixed(2)}</p>
        `;
      }
    }
  } catch (err) {
    console.error("Failed to refresh order status:", err);
  }
}

// -------------------- STEP NAVIGATION --------------------
function initSteps() {
  const steps = [
    document.getElementById("delivery-section"),
    document.getElementById("payment-section"),
    document.getElementById("confirmation-section"),
  ];
  const tabs = document.querySelectorAll(".tab");
  let currentStep = 0;

  // single showStep with lock logic (no duplicate)
  function showStep(index) {
    // Lock payment/earlier steps if payment is under review
    if (window.paymentUnderReview && index < 2) index = 2; // force confirmation step
    steps.forEach((step, i) => step?.classList.toggle("active", i === index));
    tabs.forEach((tab, i) => tab.classList.toggle("active", i <= index));
  }

  showStep(currentStep);

  document.getElementById("proceed-to-payment-btn")?.addEventListener("click", () => {
    currentStep = 1;
    showStep(currentStep);
    injectSelectedDeliveries(window.globalCheckout);
    calculateGrandTotal();
  });

  document.getElementById("proceed-to-confirmation-btn")?.addEventListener("click", () => {
    currentStep = 2;
    showStep(currentStep);
  });

  document.querySelector("#payment-section .back-btn")?.addEventListener("click", () => {
    currentStep = 0;
    showStep(currentStep);
  });

  document.querySelector("#confirmation-section .back-btn")?.addEventListener("click", () => {
    currentStep = 1;
    showStep(currentStep);
    injectSelectedDeliveries(window.globalCheckout);
    calculateGrandTotal();
  });

  document.getElementById("confirmation-btn")?.addEventListener("click", () => {
  });
}