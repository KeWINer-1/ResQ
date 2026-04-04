const copyButtons = document.querySelectorAll("[data-copy-email]");
const copyToast = document.getElementById("copy-toast");
let copyToastTimer = null;

function showCopyToast() {
  if (!copyToast) return;
  copyToast.classList.add("show");
  if (copyToastTimer) {
    clearTimeout(copyToastTimer);
  }
  copyToastTimer = setTimeout(() => {
    copyToast.classList.remove("show");
  }, 3000);
}

async function copyEmail(email) {
  try {
    await navigator.clipboard.writeText(email);
    showCopyToast();
  } catch {
    // Fallback for environments where clipboard API is blocked.
    const temp = document.createElement("textarea");
    temp.value = email;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    showCopyToast();
  }
}

copyButtons.forEach((btn) => {
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = btn.getAttribute("data-copy-email");
    if (!email) return;
    await copyEmail(email);
  });
});
