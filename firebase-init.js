// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, setDoc, doc, serverTimestamp, addDoc, runTransaction, increment, orderBy } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDGsnBtj-7APBi_o6E3mDK0RwmOL1lmJ_o",
    authDomain: "conomyi.firebaseapp.com",
    projectId: "conomyi",
    storageBucket: "conomyi.firebasestorage.app",
    messagingSenderId: "712041034398",
    appId: "1:712041034398:web:422b2ae088434dabeb018f",
    measurementId: "G-D28Z8PZESX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Analytics is optional but included
const auth = getAuth(app);
const db = getFirestore(app);

// Export all necessary variables and functions for use in script.js
export { 
    app, 
    auth, 
    db, 
    onAuthStateChanged, 
    signOut,
    collection,
    query,
    where,
    getDocs,
    setDoc,
    doc,
    getDoc,
    serverTimestamp,
    addDoc,
    runTransaction,
    increment,
    orderBy
};
