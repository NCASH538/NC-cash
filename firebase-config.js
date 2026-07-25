// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyAeY2_4Bcw1NmxqymuIvsKtrChdGbYrUa4",
  authDomain: "ncash-28237.firebaseapp.com",
  projectId: "ncash-28237",
  storageBucket: "ncash-28237.firebasestorage.app",
  messagingSenderId: "1085654247416",
  appId: "1:1085654247416:web:272157cf7a6c9371cd580d",
  measurementId: "G-6HC62GCHCS"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();
