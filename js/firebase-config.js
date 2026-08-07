/**
 * Firebase configuration.
 * 1. Go to https://console.firebase.google.com → Create project
 * 2. Project settings → General → Your apps → Web app → copy the config below
 * 3. Enable: Authentication (Email/Password + Google), Firestore, Storage
 * 4. Paste your real values here. This file is safe to expose publicly —
 *    Firebase web API keys are not secret; access is controlled by the
 *    Security Rules in /firestore.rules and /storage.rules.
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Uses the Firebase v8 "compat" SDK loaded via <script> tags in each page,
// which keeps everything GitHub-Pages-friendly (no bundler required).
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
