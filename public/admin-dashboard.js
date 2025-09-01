
async function loadPendingUsers() {
  try {
    const res = await fetch("/verification/pending");
    const users = await res.json();

    const container = document.getElementById("pendingUsers");
    container.innerHTML = ""; // clear before re-render
    const template = document.getElementById("userTemplate");

    users.forEach(user => {
      const clone = template.content.cloneNode(true);

      clone.querySelector(".username").textContent = user.fullname || "No Name";
      clone.querySelector(".userEmail").textContent = user.email;

      if (user.idFront) clone.querySelector(".idFront").src = user.idFront;
      if (user.idBack) clone.querySelector(".idBack").src = user.idBack;
      if (user.selfie) clone.querySelector(".selfie").src = user.selfie;

      // Approve button
      clone.querySelector(".approveBtn").addEventListener("click", async () => {
        await fetch(`/verification/approve/${user.userId}`, { method: "POST" });
        loadPendingUsers(); // refresh
      });

      // Reject button
      clone.querySelector(".rejectBtn").addEventListener("click", async () => {
        await fetch(`/verification/reject/${user.userId}`, { method: "POST" });
        loadPendingUsers(); // refresh
      });

      container.appendChild(clone);
    });
  } catch (err) {
    console.error("Load pending error:", err);
  }
}

// Load when "verifications" tab is opened
function showSection(id) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));

  document.querySelector(`.tab[onclick="showSection('${id}')"]`).classList.add("active");
  document.getElementById(id).classList.add("active");

  if (id === "verifications") {
    loadPendingUsers();
  }
}
