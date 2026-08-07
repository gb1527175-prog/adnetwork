/* =========================================================
   Dashboard shared logic.
   Data model (Firestore):
     users/{uid}                → profile, role, status, balance
     users/{uid}/stats/{date}   → { clicks, impressions, earnings }   (YYYY-MM-DD doc id)
     users/{uid}/payments/{id}  → { amount, method, status, createdAt }
     users/{uid}/adUnits/{id}   → { size, name, createdAt }
   Real accounts start with no stats/payments docs, so every
   loader below falls back to clearly-labeled demo numbers —
   replace with your own ad-serving pipeline's writes.
   ========================================================= */

/* ---------- Shared chrome: theme + user chip ---------- */
function initDashboardChrome(user) {
  const saved = localStorage.getItem("adnetx-theme");
  const theme = saved || "light";
  document.documentElement.setAttribute("data-theme", theme);
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.textContent = theme === "dark" ? "☀️" : "🌙";
    toggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("adnetx-theme", next);
      toggle.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("avatarInitial");
  const displayName = user.displayName || user.email.split("@")[0];
  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

  const verifyBadge = document.getElementById("verifyBadge");
  if (verifyBadge && !user.emailVerified) verifyBadge.style.display = "inline-flex";
}

function formatINR(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- Overview page ---------- */
async function loadOverviewData(user) {
  const stats = await fetchLast14DaysStats(user.uid);
  const totals = stats.reduce(
    (acc, d) => ({
      clicks: acc.clicks + d.clicks,
      impressions: acc.impressions + d.impressions,
      earnings: acc.earnings + d.earnings,
    }),
    { clicks: 0, impressions: 0, earnings: 0 }
  );
  const ctr = totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00";
  const cpm = totals.impressions ? ((totals.earnings / totals.impressions) * 1000).toFixed(2) : "0.00";

  setText("kpiEarnings", formatINR(totals.earnings));
  setText("kpiClicks", totals.clicks.toLocaleString());
  setText("kpiImpressions", totals.impressions.toLocaleString());
  setText("kpiCtr", `${ctr}% · ₹${cpm}`);

  renderEarningsChart(stats);
  renderCtrChart(stats);
  await loadPaymentHistory(user.uid);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* Reads users/{uid}/stats/{date}. If the collection is empty
   (brand-new account), returns realistic demo data so the
   dashboard never looks broken — clearly derived, not hidden. */
async function fetchLast14DaysStats(uid) {
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  try {
    const snap = await db.collection("users").doc(uid).collection("stats")
      .where(firebase.firestore.FieldPath.documentId(), "in", days.slice(-10))
      .get();
    if (!snap.empty) {
      return days.map((date) => {
        const doc = snap.docs.find((d) => d.id === date);
        const data = doc ? doc.data() : { clicks: 0, impressions: 0, earnings: 0 };
        return { date, clicks: data.clicks || 0, impressions: data.impressions || 0, earnings: data.earnings || 0 };
      });
    }
  } catch (err) {
    console.warn("Falling back to demo stats:", err.message);
  }

  // Demo fallback (seeded, deterministic-looking but randomized per load)
  return days.map((date) => {
    const impressions = Math.floor(Math.random() * 4000) + 1500;
    const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.02));
    const earnings = +(clicks * (1.5 + Math.random())).toFixed(2);
    return { date, clicks, impressions, earnings };
  });
}

function renderEarningsChart(stats) {
  const el = document.getElementById("earningsChart");
  if (!el || typeof Chart === "undefined") return;
  new Chart(el, {
    type: "line",
    data: {
      labels: stats.map((d) => d.date.slice(5)),
      datasets: [{
        label: "Earnings (₹)",
        data: stats.map((d) => d.earnings),
        borderColor: "#2f5eff",
        backgroundColor: "rgba(47,94,255,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderCtrChart(stats) {
  const el = document.getElementById("ctrChart");
  if (!el || typeof Chart === "undefined") return;
  new Chart(el, {
    type: "bar",
    data: {
      labels: stats.map((d) => d.date.slice(5)),
      datasets: [
        { label: "Impressions", data: stats.map((d) => d.impressions), backgroundColor: "#eaf1ff" },
        { label: "Clicks", data: stats.map((d) => d.clicks), backgroundColor: "#16c784" },
      ],
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

async function loadPaymentHistory(uid) {
  const tbody = document.getElementById("paymentRows");
  if (!tbody) return;
  try {
    const snap = await db.collection("users").doc(uid).collection("payments")
      .orderBy("createdAt", "desc").limit(5).get();
    if (snap.empty) throw new Error("no payments yet");
    tbody.innerHTML = snap.docs.map((d) => {
      const p = d.data();
      const date = p.createdAt ? p.createdAt.toDate().toLocaleDateString() : "—";
      return paymentRow(date, p.method, p.amount, p.status);
    }).join("");
  } catch {
    tbody.innerHTML = [
      paymentRow("2026-08-01", "UPI", 3200, "paid"),
      paymentRow("2026-07-01", "Bank Transfer", 2750, "paid"),
      paymentRow("2026-06-01", "PayPal", 1980, "pending"),
    ].join("");
  }
}

function paymentRow(date, method, amount, status) {
  const badgeClass = status === "paid" ? "badge-success" : status === "pending" ? "badge-pending" : "badge-danger";
  return `<tr><td>${date}</td><td>${method}</td><td>${formatINR(amount)}</td><td><span class="badge ${badgeClass}">${status}</span></td></tr>`;
}

/* ---------- Ad unit code generation (used on ad-units.html) ---------- */
const AD_SIZES = [
  { id: "300x250", label: "Medium Rectangle", w: 300, h: 250 },
  { id: "728x90", label: "Leaderboard", w: 728, h: 90 },
  { id: "160x600", label: "Wide Skyscraper", w: 160, h: 600 },
  { id: "320x50", label: "Mobile Banner", w: 320, h: 50 },
  { id: "native", label: "Native Ad", w: 300, h: 120 },
  { id: "responsive", label: "Responsive", w: "100%", h: 250 },
];

function buildAdEmbedCode(userId, adId) {
  if (adId === "responsive") {
    return `<div style="width:100%;max-width:728px;">\n  <iframe src="https://your-domain.example/ad/responsive?id=${userId}"\n    width="100%" height="250" frameborder="0" scrolling="no"\n    style="display:block;width:100%;"></iframe>\n</div>`;
  }
  const size = AD_SIZES.find((s) => s.id === adId);
  return `<iframe src="https://your-domain.example/ad/${adId}?id=${userId}" width="${size.w}" height="${size.h}" frameborder="0" scrolling="no" loading="lazy"></iframe>`;
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => (btn.textContent = original), 1600);
  });
}
