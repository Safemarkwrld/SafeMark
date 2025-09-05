// profile.js

// -------------------- Render Status Badge --------------------
function renderStatusBadge(user) {
  const badge = document.getElementById("user-status");
  const addressStatus = document.querySelector('.addressStatus').innerText

  if (user.verified) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="store_verified_1-64.webp" alt="Verified" id="statusIcon">
        <p id="verified-status">Verified</p>
      </div>
    `;
    addressStatus = 'Address verified by Google and Safemark.';
  } else if (user.pending) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="7415537.png" alt="Pending" id="statusIcon">
        <p id="pending-status">Pending</p>
      </div>
    `;
    addressStatus = 'Address under review, on Google Maps';
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
    addressStatus = 'Address not verified yet...';
  }
}

// -------------------- Load Profile --------------------
async function loadProfile() {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) throw new Error("Failed to fetch profile");

    const user = await res.json();

    // Fill user details
    document.getElementById("user-name").textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById("user-email").textContent = user.email;
    document.getElementById("homeAddress").textContent = user.address || "No address provided";

    // Render status badge
    renderStatusBadge(user);

    // ✅ Profile photo (direct URL or fallback)
    const profilePhoto = document.getElementById("profilePhoto");
    if (user.profileIcon) {
      profilePhoto.src = user.profileIcon; // Cloudinary URL with safe fallback
    } else {
      profilePhoto.src = "/default-avatar.png"; // must be absolute path
    }
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// -------------------- Upload Profile Photo --------------------
async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("profilePhoto", file);

  try {
    const res = await fetch("/api/profile-photo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    showMessage("✅ Profile photo updated", "success");
    loadProfile();
  } catch (err) {
    console.error("Upload error:", err);
    showMessage("❌ Failed to upload profile photo", "error");
  }
}

// -------------------- Delete Profile Photo --------------------
async function deleteProfilePhoto() {
  if (!confirm("Are you sure you want to delete your profile photo?")) return;

  try {
    const res = await fetch("/api/profile-photo", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Delete failed");

    showMessage("✅ Profile photo deleted", "success");
    loadProfile();
  } catch (err) {
    console.error("Delete error:", err);
    showMessage("❌ Failed to delete profile photo", "error");
  }
}

const myMenu = document.querySelector('.bottom-menu')
function openMenu(){
  myMenu.classList.add('menu-active');
}
function closeMenu() {
  myMenu.classList.remove('menu-active');
}

// -------------------- Init --------------------
document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  setupMenu();

  const uploadBtnMenu = document.querySelector(".photo-actions #uploadBtn");
  const uploadBtnCard = document.querySelector(".profile-picture #uploadBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  const photoInput = document.getElementById("photoInput");

  // Upload via menu
  if (uploadBtnMenu) {
    uploadBtnMenu.addEventListener("click", () => photoInput.click());
  }

  // Upload via edit button on profile card
  if (uploadBtnCard) {
    uploadBtnCard.addEventListener("click", () => photoInput.click());
  }

  // When a file is chosen → upload it
  photoInput.addEventListener("change", (e) => {
    if (e.target.files.length) uploadProfilePhoto(e.target.files[0]);
  });

  // Delete photo
  if (deleteBtn) {
    deleteBtn.addEventListener("click", deleteProfilePhoto);
  }
});