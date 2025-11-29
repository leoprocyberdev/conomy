// script.js

// 1. Import Firebase services and functions from the initialization file
import { 
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
    serverTimestamp
} from './firebase-init.js'; 

// Import specific Auth functions from the Firebase SDK (must be done directly)
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";


// --- Global UI Elements & State ---
const authPage = document.querySelector('.auth-page');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const toggleRegisterBtn = document.getElementById('toggle-to-register');

const navButtons = document.querySelectorAll('.foot-bar .nav');
const contentSections = document.querySelectorAll('.home, .Products, .my-products, .my-team, .me, .recharge-page');
const sectionMap = ['home', 'Products', 'my-products', 'my-team', 'me'];

const registerFields = document.getElementById('register-fields'); // NEW ELEMENT


let isRegistering = false;
let currentUserID = null; 

// --- Utility Functions ---

/** Hides all content sections and shows only the target section. **/
function showSection(sectionName) {
    contentSections.forEach(section => { section.style.display = 'none'; });
    const targetSection = document.querySelector(`.${sectionName}`);
    if (targetSection) { targetSection.style.display = 'block'; }
}

/** Sets the active state on the clicked navigation button. **/
function setActiveNav(activeNav) {
    navButtons.forEach(btn => { btn.classList.remove('active'); });
    activeNav.classList.add('active');
}

/** Hides the Auth page and shows the main app content (Home section). **/
function showAppContent() {
    authPage.style.display = 'none'; // Hide the login screen
    document.querySelector('.foot-bar').style.display = 'grid'; // Ensure footer is visible
    
    // Show the Home section and activate its button
    const homeSection = document.querySelector('.home');
    if (homeSection) homeSection.style.display = 'block';

    const homeNavButton = navButtons[0];
    if (homeNavButton) setActiveNav(homeNavButton);
}

/** Hides the main app content and shows the Auth page. **/
function showAuthScreen() {
    // Hide all content sections and the footer
    contentSections.forEach(s => s.style.display = 'none');
    document.querySelector('.foot-bar').style.display = 'none'; 
    
    // Show the login screen
    if (authPage) authPage.style.display = 'flex';
}

// --- Firebase Auth Handlers ---

/** Toggles between Login and Register views **/// script.js (Updated toggleAuthMode function)

/** Toggles between Login and Register views **/
function toggleAuthMode() {
    isRegistering = !isRegistering;
    if (isRegistering) {
        authTitle.textContent = "Create Account";
        authSubmitBtn.textContent = "Register";
        toggleRegisterBtn.textContent = "Log In";
        registerFields.classList.add('show'); // Show the fields
    } else {
        authTitle.textContent = "Welcome Back!";
        authSubmitBtn.textContent = "Log In";
        toggleRegisterBtn.textContent = "Register Now";
        registerFields.classList.remove('show'); // Hide the fields
    }
}



/** Handles form submission for both Login and Register **/// script.js (Complete handleAuth function)
async function handleAuth(e) {
    e.preventDefault();
    
    // Get universal fields
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    // Registration-specific fields (only valid if isRegistering is true)
    let name, contact, district;
    if (isRegistering) {
        name = document.getElementById('auth-name').value;
        contact = document.getElementById('auth-contact').value;
        district = document.getElementById('auth-district').value;
        
        // Basic check to ensure registration fields are filled
        if (!name || !contact || !district) {
            alert("Please fill in your Full Name, Contact, and District to register.");
            return;
        }
    }

    if (authSubmitBtn.textContent.includes("Processing")) return;

    const originalText = authSubmitBtn.textContent;
    authSubmitBtn.textContent = "Processing...";

    try {
        if (isRegistering) {
            // --- FIREBASE REGISTRATION ---
            
            // 1. Firebase Auth: Create user with email/password
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Firestore: Save additional user details (Name, Contact, District)
            await setDoc(doc(db, "users", user.uid), {
                fullName: name,
                contact: contact,
                district: district,
                email: email,
                createdAt: new Date(),
                balance: 0,
                totalCommission: 0,
                is_admin: false
            });
            
            alert("Registration successful! Welcome to Conomy Investments.");

        } else {
            // --- FIREBASE LOGIN (Email and Password only) ---
            await signInWithEmailAndPassword(auth, email, password);
            alert("Login successful!");
        }
        
    } catch (error) {
        let errorMessage = "An unknown error occurred.";
        if (error.code) {
            if (error.code === 'auth/email-already-in-use') errorMessage = 'This email is already registered.';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Invalid email format.';
            else if (error.code === 'auth/weak-password') errorMessage = 'Password should be at least 6 characters.';
            else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') errorMessage = 'Invalid email or password.';
            else errorMessage = `Firebase Error: ${error.code.split('/')[1]}`;
        }
        alert("Error: " + errorMessage);
        console.error("Auth Error:", error);
    } finally {
        authSubmitBtn.textContent = originalText;
    }
}



/** Handles user sign out **/
function handleSignOut() {
    signOut(auth).then(() => {
        console.log("User signed out successfully.");
        // UI is automatically updated by onAuthStateChanged
    }).catch((error) => {
        console.error("Sign Out Error:", error);
        alert("Sign out failed: " + error.message);
    });
}


// --- Data Loading: My Products ---

async function loadMyProducts() {
    if (!currentUserID) {
        document.querySelector('.my-product-list').innerHTML = '<p class="error-state">Please sign in to view your products.</p>';
        return;
    }

    const myProductList = document.querySelector('.my-product-list');
    const emptyState = document.querySelector('.empty-state');
    
    // Reset views
    myProductList.innerHTML = '<p class="loading-state">Loading your investments...</p>';
    if(emptyState) emptyState.style.display = 'none';

    try {
        // Query Firestore for investments belonging to the current user
        const q = query(collection(db, 'investments'), where('userId', '==', currentUserID));
        const investmentsSnapshot = await getDocs(q);

        myProductList.innerHTML = ''; 

        if (investmentsSnapshot.empty) {
            if(emptyState) emptyState.style.display = 'block';
            return;
        }

        investmentsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Data mapping (assuming product details are stored under data)
            const statusClass = data.status === 'active' ? 'active' : data.status === 'completed' ? 'finished' : 'pending';
            const statusText = data.status === 'active' ? 'In Progress' : data.status === 'completed' ? 'Completed' : 'Pending Activation';
            
            // Fallbacks for display
            const investmentAmount = data.investmentAmount ? data.investmentAmount.toLocaleString() : 'N/A';
            const dailyIncome = data.dailyIncome ? data.dailyIncome.toLocaleString() : 'N/A';
            const totalEarned = data.totalEarned ? data.totalEarned.toLocaleString() : 'N/A';

            // Dynamically build the investment card
            const cardHTML = `
                <div class="my-product-card ${statusClass}-status">
                    <div class="card-header">
                        <h3 class="product-name">${data.productName || 'Unknown Product'}</h3>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="card-details">
                        <p>Investment Amount: <span class="amount">UGX${investmentAmount}</span></p>
                        <p>Daily Income: <span class="income">UGX${dailyIncome}</span></p>
                        <p>Cycle Progress: <span class="progress">${data.daysProgress || 0} / ${data.cycleDays || 0} Days</span></p>
                    </div>
                    <div class="card-footer">
                        <p class="total-earned">Total Earned: <span>UGX${totalEarned}</span></p>
                        <button class="view-details-btn">View Details</button>
                    </div>
                </div>
            `;
            myProductList.innerHTML += cardHTML;
        });

    } catch (error) {
        console.error("Error loading my products:", error);
        myProductList.innerHTML = '<p class="error-state">Failed to load investments. Check console for details.</p>';
    }
}


// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Attach Authentication Event Listeners ---
    
    // Login/Register Form Submission
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
    // Toggle between Login and Register views
    if (toggleRegisterBtn) {
        toggleRegisterBtn.addEventListener('click', toggleAuthMode);
    }
    // Sign Out link/button in the 'Me' section
    const signOutButton = document.querySelector('.me-menu-list .sign-out');
    if (signOutButton) {
        signOutButton.addEventListener('click', (e) => {
            e.preventDefault(); 
            handleSignOut();
        });
    }

    // --- 2. Attach Navigation & Conditional Data Loading Click Listeners ---
    
    // Standard Footer Navigation
    navButtons.forEach((navButton, index) => {
        navButton.addEventListener('click', () => {
            const targetSectionName = sectionMap[index];

            showSection(targetSectionName);
            setActiveNav(navButton);
            window.scrollTo(0, 0); 
            
            // Conditional data loading when My Products is viewed
            if (targetSectionName === 'my-products') {
                 loadMyProducts(); 
            }
        });
    });

    // Recharge Link Navigation (from the 'Me' section menu)
    // Assumes the link has an ID or unique selector, e.g., <a href="#" id="recharge-link">
    const rechargeLink = document.querySelector('.me-menu-list a[href="#recharge"]');
    if (rechargeLink) {
        rechargeLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Assuming 'recharge-page' is included in your sectionMap/contentSections
            showSection('recharge-page'); 
            window.scrollTo(0, 0); 
        });
    }

    // Recharge Form Submission
    const rechargeForm = document.getElementById('recharge-form');
    if (rechargeForm) {
        rechargeForm.addEventListener('submit', handleRecharge);
    }

    // --- 3. Firebase Authentication State Listener (Controls UI visibility) ---
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in.
            currentUserID = user.uid;
            console.log("User is logged in:", currentUserID);
            
            // Fetch and display the user's name from Firestore profile
            updateMeSectionUI(user.uid); 
            
            showAppContent(); // Show the main app content (starting with 'home' section)
        } else {
            // User is signed out.
            currentUserID = null;
            console.log("User is logged out.");
            showAuthScreen(); // Show the login/register screen
        }
    });

});







/** Fetches the full name from Firestore and updates the Me section UI. **/async function updateMeSectionUI(uid) {
    if (!uid) return;

    // 1. Get the DOM elements for the Me section (assuming you have a .me .username element)
    const usernameElement = document.querySelector('.me .username');
    // Assuming you also want to display the short ID
    const idElement = document.querySelector('.me .id'); 

    // Set loading/default text
    if (usernameElement) usernameElement.textContent = 'Loading...';
    if (idElement) idElement.textContent = `ID: ${uid.substring(0, 6)}...`;

    try {
        // 2. Fetch the user document from the 'users' collection
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // 3. 🚨 DISPLAY THE NAME: Prioritize the 'fullName' field
            if (usernameElement) {
                // Display the Full Name, fall back to email, then a generic title
                usernameElement.textContent = userData.fullName || userData.email || 'Investment User';
            }
            
            console.log("Me section updated with Full Name:", userData.fullName);
        } else {
            // Document missing (for users created before the new registration logic)
            console.warn("User document not found in Firestore for UID:", uid);
            
            // 4. Fallback: Display Email if the profile document is missing
            if (usernameElement && auth.currentUser) {
                 // Fallback to email display since the name is unavailable
                 usernameElement.textContent = auth.currentUser.email || 'User Profile';
            }
        }
    } catch (error) {
        console.error("Error fetching user data for Me section:", error);
        if (usernameElement) usernameElement.textContent = 'Error Loading Profile';
    }
}


// script.js (Add this function)

async function handleRecharge(e) {
    e.preventDefault();

    if (!currentUserID) {
        alert("Please log in to make a deposit request.");
        return;
    }

    const amountInput = document.getElementById('recharge-amount');
    const momoNumberInput = document.getElementById('momo-number');
    const submitBtn = document.getElementById('recharge-submit-btn');

    const amount = Number(amountInput.value);
    const momoNumber = momoNumberInput.value.trim();

    if (amount < 1000) {
        alert("Minimum deposit amount is UGX 1,000.");
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    try {
        // 1. Save the recharge request to the 'recharges' collection
        await addDoc(collection(db, "recharges"), {
            userId: currentUserID,
            amount: amount,
            method: "MTN Mobile Money",
            momoNumber: momoNumber,
            status: "Pending", // Status is pending until verified by admin
            requestDate: serverTimestamp() 
        });

        alert(`Deposit request of UGX ${amount.toLocaleString()} submitted successfully!`);
        document.getElementById('recharge-form').reset(); // Clear the form

    } catch (error) {
        console.error("Error submitting recharge request:", error);
        alert("Failed to submit deposit request. Please try again.");
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}
