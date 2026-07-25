// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSy...", // ضع مفتاحك
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:abcdef"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();
