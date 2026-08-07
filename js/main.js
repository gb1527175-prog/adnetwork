/* =========================================================
   Landing page interactions (no Firebase dependency — this
   file runs standalone on the public marketing page).
   ========================================================= */

/* ---------- PWA service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

/* ---------- Dark mode ---------- */
(function initTheme() {
  const saved = localStorage.getItem("adnetx-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
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
})();

/* ---------- Reveal on scroll ---------- */
(function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((el) => io.observe(el));
})();

/* ---------- Live-look ticker (signature element) ----------
   Simulated realtime feed for the marketing page. On the
   authenticated dashboard, ticker/stat values are replaced
   with real Firestore-backed numbers — see dashboard.js. */
(function initTicker() {
  const track = document.getElementById("tickerTrack");
  if (!track) return;
  const sites = ["techdaily.in", "traveljunkie.com", "codebyte.dev", "recipehub.co", "moneytips.in", "gamezone.net"];
  const items = [];
  for (let i = 0; i < 2; i++) {
    sites.forEach((site) => {
      const clicks = Math.floor(Math.random() * 900) + 50;
      const earn = (Math.random() * 40 + 2).toFixed(2);
      items.push(`<div class="ticker-item"><span class="dot"></span>${site} · <span class="val">+${clicks}</span> clicks · <span class="val">₹${earn}</span></div>`);
    });
  }
  track.innerHTML = items.join("");
})();

/* ---------- Animated stat counters ---------- */
(function initCounters() {
  const nums = document.querySelectorAll(".stat-num[data-count]");
  if (!nums.length) return;
  const animate = (el) => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const isDecimal = target % 1 !== 0;
    let current = 0;
    const step = target / 60;
    const tick = () => {
      current += step;
      if (current >= target) current = target;
      el.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.floor(current).toLocaleString()) + suffix;
      if (current < target) requestAnimationFrame(tick);
    };
    tick();
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animate(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    nums.forEach((el) => io.observe(el));
  } else {
    nums.forEach(animate);
  }
})();

/* ---------- FAQ accordion ---------- */
(function initFaq() {
  document.querySelectorAll(".faq-item .faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
})();

/* ---------- Hero sparkline (lightweight canvas, no dependency) ---------- */
(function initSparkline() {
  const canvas = document.getElementById("heroSparkline");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height;
  const points = Array.from({ length: 24 }, () => 30 + Math.random() * 40);
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - p;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#16c784";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(22,199,132,0.25)");
  grad.addColorStop(1, "rgba(22,199,132,0)");
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fillStyle = grad;
  ctx.fill();
})();

/* ---------- Contact form ----------
   Client-side validated. Wire the fetch() below to your own
   backend/Cloud Function or a form service (e.g. Formspree)
   — static hosting alone cannot send email. */
(function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("contactStatus");
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      status.textContent = "Please fill in every field.";
      status.style.color = "var(--danger)";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Enter a valid email address.";
      status.style.color = "var(--danger)";
      return;
    }

    status.textContent = "Sending…";
    status.style.color = "var(--text-muted)";

    try {
      // If Firestore is configured, log the message as a support ticket.
      if (typeof db !== "undefined") {
        await db.collection("contactMessages").add({
          name, email, message,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      status.textContent = "Thanks — we'll get back to you within a day.";
      status.style.color = "var(--mint)";
      form.reset();
    } catch (err) {
      status.textContent = "Couldn't send right now. Please email us directly.";
      status.style.color = "var(--danger)";
    }
  });
})();
