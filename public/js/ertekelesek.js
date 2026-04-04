const messageEl = document.getElementById("ratings-message");
const avgStarsFillEl = document.getElementById("avg-stars-fill");
const avgStarsValueEl = document.getElementById("avg-stars-value");
const countEl = document.getElementById("ratings-count");
const listEl = document.getElementById("ratings-list");

function formatStars(stars) {
  const n = Math.max(1, Math.min(5, Number(stars) || 0));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("hu-HU");
}

function renderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = "<p class=\"notice\">Még nincs értékelés.</p>";
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const stars = Number(item.Stars || 0);
      const comment = String(item.Comment || "").trim();
      const user = item.UserEmail || "Felhasznalo";
      const createdAt = formatDate(item.CreatedAt);
      return `<article class="card rating-item">
        <div class="rating-item-top">
          <strong class="rating-stars">${formatStars(stars)} <span class="rating-value">(${stars}/5)</span></strong>
          <span class="notice">${createdAt}</span>
        </div>
        <div class="notice">Ertekelte: ${user}</div>
        <p class="rating-comment">${comment || "Nincs szoveges velemeny."}</p>
      </article>`;
    })
    .join("");
}

async function init() {
  if (!getToken()) {
    window.location.href = "/auth";
    return;
  }

  const role = getUserRole();
  if (role !== "Provider") {
    window.location.href = role === "Admin" ? "/admin" : "/map";
    return;
  }

  try {
    const data = await apiFetch("/api/providers/me/ratings");
    const total = Number(data.totalCount || 0);
    const avg = data.avgStars == null ? null : Number(data.avgStars);
    if (avgStarsFillEl) {
      const safeAvg = avg == null ? 0 : Math.max(0, Math.min(5, avg));
      avgStarsFillEl.style.width = `${(safeAvg / 5) * 100}%`;
    }
    if (avgStarsValueEl) {
      avgStarsValueEl.textContent = avg == null ? "- / 5" : `${avg.toFixed(1)} / 5`;
    }
    countEl.textContent = `${total} db`;
    renderItems(data.items || []);
    messageEl.textContent = "";
  } catch (err) {
    messageEl.textContent = "Nem sikerült betölteni az értékeléseket.";
    renderItems([]);
  }
}

init();
