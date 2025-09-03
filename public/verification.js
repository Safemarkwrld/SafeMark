// ---------------- Step Navigation ----------------
const steps = document.querySelectorAll(".step");
let currentStep = 0;

function showStep(index) {
  steps.forEach((step, i) => {
    step.classList.toggle("active", i === index);
  });
  currentStep = index;
}

// ---------------- Step 1 -> Step 2 ----------------
document.getElementById("next1").addEventListener("click", () => {
  const fullName = document.getElementById("fullName").value.trim();
  const dob = document.getElementById("dob").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!fullName || !dob || !email || !phone) {
    alert("Please fill in all fields.");
    return;
  }
  showStep(1);
});

// ---------------- Step 2: Address + Pin ----------------
document.getElementById("next2").addEventListener("click", () => {
  const address = document.getElementById("address").value.trim();
  const lat = parseFloat(document.getElementById("latitudePin").value.trim());
  const lon = parseFloat(document.getElementById("longitudePin").value.trim());

  if (!address || isNaN(lat) || isNaN(lon)) {
    alert("Please fill in address and valid latitude/longitude.");
    return;
  }

  // South Africa bounds check
  if (lat < -35 || lat > -22 || lon < 16 || lon > 33) {
    alert("Latitude/Longitude must be within South Africa.");
    return;
  }

  showStep(2);
});

document.getElementById("prev2").addEventListener("click", () => showStep(0));

// ---------------- Step 3: Upload ID ----------------
document.getElementById("next3").addEventListener("click", () => {
  const idFront = document.getElementById("idFront").files[0];
  const idBack = document.getElementById("idBack").files[0];

  if (!idFront || !idBack) {
    alert("Please upload both ID front and back.");
    return;
  }
  showStep(3);
});

document.getElementById("prev3").addEventListener("click", () => showStep(1));

// ---------------- Step 4: Selfie ----------------
const video = document.getElementById("video");
const canvas = document.getElementById("selfieCanvas");
const selfieInput = document.getElementById("selfie");

// Start camera
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => { video.srcObject = stream; })
    .catch(() => alert("Unable to access camera."));
}

function captureSelfie() {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    const file = new File([blob], "selfie.png", { type: "image/png" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    selfieInput.files = dataTransfer.files;
    alert("Selfie captured ✅");
  });
}

document.getElementById("next4").addEventListener("click", () => {
  if (!selfieInput.files.length) {
    alert("Please capture a selfie first.");
    return;
  }
  showStep(4);
});

document.getElementById("prev4").addEventListener("click", () => showStep(2));

// ---------------- Step 5: Submit ----------------
document.getElementById("prev5").addEventListener("click", () => showStep(3));

function submitVerification() {
  const formData = new FormData();

  // Step 1
  formData.append("fullName", document.getElementById("fullName").value.trim());
  formData.append("dob", document.getElementById("dob").value.trim());
  formData.append("email", document.getElementById("email").value.trim());
  formData.append("phone", document.getElementById("phone").value.trim());

  // Step 2
  formData.append("address", document.getElementById("address").value.trim());
  formData.append("latitude", document.getElementById("latitudePin").value.trim());
  formData.append("longitude", document.getElementById("longitudePin").value.trim());

  // Step 3
  formData.append("idFront", document.getElementById("idFront").files[0]);
  formData.append("idBack", document.getElementById("idBack").files[0]);

  // Step 4
  if (selfieInput.files[0]) {
    formData.append("selfie", selfieInput.files[0]);
  }

  fetch("/verification/submit", {
    method: "POST",
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.success){
        window.location.href = "landingpage.html";
      } else {
        console.log("Something went wrong");
      }
    })
    .catch(err => {
      alert("Submission failed ❌. Please try again.");
      console.error(err);
    });
}

// ---------------- Init ----------------
showStep(0);