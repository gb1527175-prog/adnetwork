/* =========================================================
   Admin panel logic.
   IMPORTANT: this file only hides/shows UI based on the
   `role` field on the signed-in user's Firestore doc. That is
   a UX convenience, not security — the real enforcement is in
   firestore.rules, which must restrict writes to admin-only
   collections/fields to accounts where role == "admin".
   ========================================================= */

const TABS = ["users", "ads", "revenue", "payments", "settings"];
const TAB_TITLES = {
  users: "User Management",
  ads: "Ad Inventory",
  revenue: "Revenue Reports",
  payments: "Payment Requests",
  settings: "Site Settings",
};

requireAuth(async (user) => {
  initDashboardChrome(user);
  const profileSnap = await db.collection("users").doc(user.uid).get();
  const role = profileSnap.exists ? profileSnap.data().role : "publisher";

  if (role !== "admin") {
    document.getElementById("accessNotice").style.display = "block";
    return;
  }

  document.getElementById("panels").style.display = "block";
  initTabs();
  loadUsers();
  loadAds();
  loadPendingPayments();
  renderRevenueChart();
});

document.getElementById("logoutLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  logout();
});

function initTabs() {
  document.querySelectorAll(".side-link[data-tab]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      TABS.forEach((t) => {
        document.getElementById(`tab-${t}`).style.display = t === tab ? "block" : "none";
      });
      document.querySelectorAll(".side-link[data-tab]").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      document.getElementById("panelTitle").textContent = TAB_TITLES[tab];
    });
  });
}

/* ---------- Users ---------- */
async function loadUsers() {
  const tbody = document.getElementById("userRows");
  try {
    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(50).get();
    if (snap.empty) throw new Error("no users");
    let active = 0, blocked = 0;
    tbody.innerHTML = snap.docs.map((doc) => {
      const u = doc.data();
      if (u.status === "blocked") blocked++; else active++;
      return userRow(doc.id, u);
    }).join("");
    setText("statTotalUsers", snap.size);
    setText("statActiveUsers", active);
    setText("statBlockedUsers", blocked);
    setText("statNewUsers", Math.min(snap.size, 12));
  } catch {
    const demo = [
      { id: "demo1", name: "Riya Sharma", email: "riya@techdaily.in", balance: 4820, status: "active" },
      { id: "demo2", name: "Arjun Mehta", email: "arjun@codebyte.dev", balance: 1120, status: "active" },
      { id: "demo3", name: "Sana Iyer", email: "sana@travelhub.co", balance: 260, status: "blocked" },
    ];
    tbody.innerHTML = demo.map((u) => userRow(u.id, u)).join("");
    setText("statTotalUsers", 18400);
    setText("statActiveUsers", 18120);
    setText("statBlockedUsers", 280);
    setText("statNewUsers", 312);
  }
}

function userRow(id, u) {
  const isBlocked = u.status === "blocked";
  return `<tr>
    <td>${escapeHtml(u.name || "—")}</td>
    <td>${escapeHtml(u.email || "—")}</td>
    <td>${formatINR(u.balance || 0)}</td>
    <td><span class="badge ${isBlocked ? "badge-danger" : "badge-success"}">${isBlocked ? "blocked" : "active"}</span></td>
    <td><button class="btn btn-sm ${isBlocked ? "btn-outline" : "btn-danger"}" onclick="toggleUserBlock('${id}', ${isBlocked})">${isBlocked ? "Unblock" : "Block"}</button></td>
  </tr>`;
}

async function toggleUserBlock(uid, isCurrentlyBlocked) {
  try {
    await db.collection("users").doc(uid).update({ status: isCurrentlyBlocked ? "active" : "blocked" });
    loadUsers();
  } catch {
    alert("Demo record — connect Firestore to persist this action.");
  }
}

/* ---------- Ads ---------- */
async function loadAds() {
  const tbody = document.getElementById("adRows");
  try {
    const snap = await db.collection("adCampaigns").orderBy("createdAt", "desc").get();
    tbody.innerHTML = snap.empty ? emptyAdsRow() : snap.docs.map((d) => adRow(d.id, d.data())).join("");
  } catch {
    tbody.innerHTML = emptyAdsRow();
  }
}
function emptyAdsRow() {
  return `<tr><td colspan="3" class="text-muted">No campaigns yet — add one from the form.</td></tr>`;
}
function adRow(id, ad) {
  return `<tr><td>${escapeHtml(ad.name)}</td><td>${ad.size}</td><td><button class="btn btn-sm btn-danger" onclick="removeAd('${id}')">Remove</button></td></tr>`;
}
document.getElementById("addAdForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("adName").value.trim();
  const size = document.getElementById("adSize").value;
  const url = document.getElementById("adUrl").value.trim();
  try {
    await db.collection("adCampaigns").add({ name, size, url, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    e.target.reset();
    loadAds();
  } catch {
    alert("Connect Firestore to persist campaigns.");
  }
});
async function removeAd(id) {
  try {
    await db.collection("adCampaigns").doc(id).delete();
    loadAds();
  } catch {
    alert("Connect Firestore to persist this action.");
  }
}

/* ---------- Payments ---------- */
async function loadPendingPayments() {
  const tbody = document.getElementById("pendingPaymentRows");
  try {
    const snap = await db.collectionGroup("payments").where("status", "==", "pending").limit(20).get();
    if (snap.empty) throw new Error("none");
    tbody.innerHTML = snap.docs.map((d) => pendingPaymentRow(d.ref.path, d.data())).join("");
  } catch {
    tbody.innerHTML = [
      pendingPaymentRow("demo/1", { method: "UPI", amount: 1800, detail: "riya@upi" }),
      pendingPaymentRow("demo/2", { method: "PAYPAL", amount: 950, detail: "arjun@example.com" }),
    ].join("");
  }
}
function pendingPaymentRow(path, p) {
  return `<tr>
    <td>${escapeHtml(p.detail || "publisher")}</td>
    <td>${p.method}</td>
    <td>${formatINR(p.amount)}</td>
    <td><span class="badge badge-pending">pending</span></td>
    <td><button class="btn btn-sm btn-primary" onclick="approvePayment('${path}')">Approve</button></td>
  </tr>`;
}
async function approvePayment(path) {
  try {
    await db.doc(path).update({ status: "paid" });
    loadPendingPayments();
  } catch {
    alert("Demo record — connect Firestore to persist this action.");
  }
}

/* ---------- Revenue chart ---------- */
function renderRevenueChart() {
  const el = document.getElementById("revenueChart");
  if (!el || typeof Chart === "undefined") return;
  const labels = Array.from({ length: 14 }, (_, i) => `Day ${i + 1}`);
  new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Gross Revenue (₹)",
        data: labels.map(() => Math.floor(Math.random() * 40000) + 25000),
        borderColor: "#2f5eff",
        backgroundColor: "rgba(47,94,255,0.12)",
        fill: true,
        tension: 0.35,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });
}

/* ---------- Settings ---------- */
document.getElementById("saveSettingsBtn")?.addEventListener("click", async () => {
  const config = {
    siteName: document.getElementById("cfgSiteName").value,
    minWithdraw: Number(document.getElementById("cfgMinWithdraw").value),
    revShare: Number(document.getElementById("cfgRevShare").value),
  };
  try {
    await db.collection("siteConfig").doc("main").set(config, { merge: true });
  } catch { /* demo mode — ignore */ }
  const saved = document.getElementById("settingsSaved");
  saved.style.display = "block";
  setTimeout(() => (saved.style.display = "none"), 2000);
});

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
