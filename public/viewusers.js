// -------------------- Render Status Badge --------------------
function renderStatusBadge(user) {
  const badge = document.getElementById("user-status");
  const addressStatus = document.querySelector('.addressStatus');

  if (user.verified) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="store_verified_1-64.webp" alt="Verified" id="statusIcon">
        <p id="verified-status">Verified</p>
      </div>
    `;
    addressStatus.innerText = 'Address verified by Google and Safemark.';
  } else if (user.pending) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="7415537.png" alt="Pending" id="statusIcon">
        <p id="pending-status">Pending</p>
      </div>
    `;
    addressStatus.innerText = 'Address under review, on Google Maps';
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
    addressStatus.innerText = "Couldn't verify your address...";
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
    document.getElementById("homeAddress").textContent = user.address
      ? user.address
      : "No address available";

    // ✅ Profile photo (direct Cloudinary URL or fallback)
    const photoEl = document.getElementById("profilePhoto");
    photoEl.src = user.profileIcon || "default-avatar.png";
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

function requestBtn(){
  const requestBtn = document.querySelector('.requestBtn');
  if (requestBtn.innerHTML === 'Request'){
    requestBtn.innerHTML = 'Cancel request'
    requestBtn.classList.add('cancel-request');
    alert(`Request sent!`)
  } else {
    requestBtn.innerHTML = 'Request'
    requestBtn.classList.remove('cancel-request')
    alert(`Request cancelled!`)
  }
};
function reportBtn(){
  const reportBtn = document.querySelector('.reportBtn');
  if (reportBtn.innerHTML === 'Report'){
    reportBtn.innerHTML = 'Reported'
    reportBtn.classList.add('reported')
    alert(`User reported! SafeMark will start investigating.`)
  } else {
    reportBtn.innerHTML = 'Report'
    reportBtn.classList.remove('reported')
  }
};