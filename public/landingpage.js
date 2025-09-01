
// -------------------- Render Status Badge --------------------
function renderStatusBadge(user) {
  const badge = document.getElementById("user-status");

  if (user.verified) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="store_verified_1-64.webp" alt="Verified" id="statusIcon">
        <p id="verified-status">Verified</p>
      </div>
    `;
  } else if (user.pending) {
    badge.innerHTML = `
      <div class="statusId">
        <img src="7415537.png" alt="Pending" id="statusIcon">
        <p id="pending-status">Pending</p>
      </div>
    `;
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
  }
}

// === Sidebar show/hide code ===
    const openBtn = document.getElementById('openmenu');
const closeBtn = document.getElementById('closemenu');
const menu = document.getElementById('menu');
const more = document.getElementById('more');

openBtn.addEventListener('click', () => {
    more.style.display = 'block'; // show the hidden container
    menu.style.transform = 'translateX(0%)'; // slide in the sidebar
    document.body.style.overflow = 'hidden'; // optional: prevent background scroll
});

closeBtn.addEventListener('click', () => {
    menu.style.transform = 'translateX(100%)'; // slide out the sidebar
    setTimeout(() => {
        more.style.display = 'none'; // hide the outer container after animation
        document.body.style.overflow = '';
    }, 300); // wait for animation to finish
});