// Import Firebase SDK (v9+ modular SDK works in Node.js)
const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

// ========================================
// Firebase Configuration
// ========================================
// TODO: Replace with your own Firebase project credentials
// Get your config from: https://console.firebase.google.com/
// Project Settings > General > Your apps > SDK setup and configuration

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional for Analytics
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { db };
