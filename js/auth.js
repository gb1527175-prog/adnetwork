/* =========================================================
   Auth module — sign up, sign in, Google, reset, verification.
   Depends on firebase-config.js being loaded first.
   ========================================================= */

const googleProvider = new firebase.auth.GoogleAuthProvider();

// Basic client-side validation helpers (defense in depth — real
// enforcement lives in Firestore/Storage Security Rules, never trust
// the client alone).
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isStrongPassword(pw) {
  return pw.length >= 8;
}
// Strip anything that looks like markup before it ever reaches Firestore,
// to reduce stored-XSS risk from user-entered display names/bios.
function sanitizeText(str) {
  return String(str).replace(/[<>]/g, "");
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}
function hideError(el) {
  if (!el) return;
  el.style.display = "none";
}

/* ---------- Register ---------- */
async function registerUser({ name, email, password }, { onSuccess, onError }) {
  try {
    if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
    if (!isStrongPassword(password)) throw new Error("Password must be at least 8 characters.");

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: sanitizeText(name) });

    // Create the publisher profile document. Default role "publisher",
    // status "active" — admins can block via the Admin Panel.
    await db.collection("users").doc(cred.user.uid).set({
      name: sanitizeText(name),
      email,
      role: "publisher",
      status: "active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      balance: 0,
      referralCode: cred.user.uid.slice(0, 8),
    });

    await cred.user.sendEmailVerification();
    onSuccess && onSuccess(cred.user);
  } catch (err) {
    onError && onError(friendlyAuthError(err));
  }
}

/* ---------- Login ---------- */
async function loginUser({ email, password }, { onSuccess, onError }) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    onSuccess && onSuccess(cred.user);
  } catch (err) {
    onError && onError(friendlyAuthError(err));
  }
}

/* ---------- Google login ---------- */
async function loginWithGoogle({ onSuccess, onError }) {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const ref = db.collection("users").doc(result.user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        name: sanitizeText(result.user.displayName || "New Publisher"),
        email: result.user.email,
        role: "publisher",
        status: "active",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        balance: 0,
        referralCode: result.user.uid.slice(0, 8),
      });
    }
    onSuccess && onSuccess(result.user);
  } catch (err) {
    onError && onError(friendlyAuthError(err));
  }
}

/* ---------- Forgot password ---------- */
async function resetPassword(email, { onSuccess, onError }) {
  try {
    if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
    await auth.sendPasswordResetEmail(email);
    onSuccess && onSuccess();
  } catch (err) {
    onError && onError(friendlyAuthError(err));
  }
}

/* ---------- Logout ---------- */
function logout() {
  auth.signOut().then(() => (window.location.href = "/auth/login.html"));
}

/* ---------- Route guard: call at top of protected pages ---------- */
function requireAuth(cb) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
    } else {
      cb(user);
    }
  });
}

function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "That email is already registered. Try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Try again or reset it.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  };
  return map[err.code] || err.message || "Something went wrong. Please try again.";
}
