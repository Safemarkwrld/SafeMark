// -------------------- Helper: Safe Profile Icon --------------------
function safeProfileIcon(icon) {
  if (icon && icon.trim() !== "") return icon;
  return `${window.location.origin}/default-avatar.png`; 
}

// -------------------- Render Status Badge --------------------
function renderStatusBadge(user) {
  const badge = document.getElementById("user-status");
  const addressStatus = document.querySelector(".addressStatus");

  if (user.verified) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="store_verified_1-64.webp" alt="Verified" id="statusIcon">
        <p id="verified-status">Verified</p>
      </div>
    `;
    addressStatus.innerText = "Address verified by Google and Safemark.";
  } else if (user.pending) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="7415537.png" alt="Pending" id="statusIcon">
        <p id="pending-status">Pending</p>
      </div>
    `;
    addressStatus.innerText = "Address under review, on Google Maps";
  } else {
    badge.innerHTML = `
      <div class="holder">
        <div class="statusId">
          <img src="declined-identity.webp" alt="Rejected" id="statusIcon">
          <p id="rejected-status">Not uploaded / Rejected</p>
        </div>
        <a href="verification.html" id="re-upload">Re-Upload documents</a>
      </div>
    `;
    addressStatus.innerText = "Couldn't verify this user's address...";
  }
}

// -------------------- Load Public Profile --------------------
document.addEventListener("DOMContentLoaded", async () => {
  const userId = window.location.hash.substring(1); // e.g. #sm25mf3001
  if (!userId) {
    alert("No user selected");
    return;
  }

  try {
    // Fetch profile
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) throw new Error("User not found");
    const user = await res.json();

    // Populate UI
    document.getElementById("user-name").textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById("user-email").textContent = user.email;
    renderStatusBadge(user);

    // Address (from Verification)
    document.getElementById("homeAddress").textContent =
      user.address && user.address.trim() !== ""
        ? user.address
        : "No address available";

    // ✅ Profile photo (use safe helper)
    const photoEl = document.getElementById("profilePhoto");
    photoEl.src = safeProfileIcon(user.profileIcon);
  } catch (err) {
    console.error("Error loading user:", err);
    alert("Failed to load profile");
  }

  // Setup menu after page loads
  setupMenu();
});

// -------------------- Menu Open/Close --------------------
function setupMenu() {
  const openMenuBtn = document.getElementById("openmenu");
  const closeMenuBtn = document.getElementById("closemenu");
  const moreMenu = document.getElementById("more");

  if (!openMenuBtn || !closeMenuBtn || !moreMenu) return;

  openMenuBtn.addEventListener("click", () => {
    moreMenu.style.display = "block";
  });

  closeMenuBtn.addEventListener("click", () => {
    moreMenu.style.display = "none";
  });
}

// -------------------- Request & Report --------------------
function requestBtn() {
  const btn = document.querySelector(".requestBtn");
  const isRequested = btn.dataset.requested === "true";

  if (!isRequested) {
    btn.textContent = "Cancel request";
    btn.classList.add("cancel-request");
    btn.dataset.requested = "true";
    alert("Request sent!");
  } else {
    btn.textContent = "Request";
    btn.classList.remove("cancel-request");
    btn.dataset.requested = "false";
    alert("Request cancelled!");
  }
}

function reportBtn() {
  const btn = document.querySelector(".reportBtn");
  const isReported = btn.dataset.reported === "true";

  if (!isReported) {
    btn.textContent = "Reported";
    btn.classList.add("reported");
    btn.dataset.reported = "true";
    alert("User reported! SafeMark will start investigating.");
  } else {
    btn.textContent = "Report";
    btn.classList.remove("reported");
    btn.dataset.reported = "false";
  }
}