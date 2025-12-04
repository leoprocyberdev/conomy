// script.js
// 1. Import Firebase services and functions from the initialization file
import { 
    auth, db, onAuthStateChanged, signOut, collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp, addDoc, runTransaction, increment, orderBy
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

// 🚨 UPDATED: Include ALL content sections, especially new pages like the activity log
const contentSections = document.querySelectorAll(
    '.auth-page, .home, .Products, .my-products, .my-team, .me, .recharge-page, .withdrawal-page, .activity-log-page' 
    // Add any other top-level section classes here
); 

const sectionMap = ['home', 'Products', 'my-products', 'my-team', 'me'];

const registerFields = document.getElementById('register-fields'); // NEW ELEMENT


let isRegistering = false;
let currentUserID = null; 

// --- Utility Functions ---

/** * Hides all content sections and shows only the target section.
 * CRITICAL for preventing content overlap on navigation.
 **/// script.js (The core navigation function)

/** * Hides all main content sections and shows only the requested one.
 * This is crucial to prevent page content overlap.
 */
function showSection(sectionClassName) {
    // 1. Iterate through ALL registered content sections
    contentSections.forEach(section => {
        if (section) {
            // 2. Hide every section
            section.style.display = 'none'; 
        }
    });

    // 3. Find and show only the requested section
    const targetSection = document.querySelector(`.${sectionClassName}`);
    if (targetSection) {
        targetSection.style.display = 'block'; 
    } else {
        console.error(`Attempted to show section, but .${sectionClassName} was not found.`);
    }
}



/** Sets the active state on the clicked navigation button. **/
function setActiveNav(activeNav) {
    navButtons.forEach(btn => { btn.classList.remove('active'); });
    activeNav.classList.add('active');
}

/** Hides the Auth page and shows the main app content (Home section). **/
function showAppContent() {
    // 1. Hide the auth page and show the footer
    const authSection = document.querySelector('.auth-page');
    if (authSection) authSection.style.display = 'none';

    document.querySelector('.foot-bar').style.display = 'grid'; // Ensure footer is visible
    
    // 2. Show the Home section and activate its button
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



/** Handles form submission for both Login and Register **/// script.js (Complete handleAuth function

async function handleAuth(e) {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    // 🚨 Captures full name and converts referral code input to uppercase
    const fullName = document.getElementById('auth-name')?.value || ''; 
    const referredBy = document.getElementById('auth-referred-by')?.value.toUpperCase() || null; 

    if (!email || !password) {
        alert('Please enter both email and password.');
        return;
    }

    try {
        if (isRegistering) {
            // --- REGISTRATION LOGIC ---
            
            if (!fullName) {
                alert('Please enter your full name.');
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 1. Generate unique referral code (first 6 chars of UID)
            const referralCode = user.uid.substring(0, 6).toUpperCase(); 
            
            // 2. Save new user's profile data
            await setDoc(doc(db, "users", user.uid), {
                userId: user.uid,
                fullName: fullName, 
                email: email,
                balance: 0, 
                joinDate: serverTimestamp(),
                
                // Referral Fields
                referralCode: referralCode, 
                referredBy: referredBy,      
                referralCount: 0,           
            });

            // 3. Update Referrer's count and Subcollection (if a valid code was used)
            if (referredBy) {
                // Find the referrer document using the referral code
                const q = query(collection(db, "users"), where("referralCode", "==", referredBy));
                const referrerSnapshot = await getDocs(q);

                if (!referrerSnapshot.empty) {
                    const referrerDoc = referrerSnapshot.docs[0];
                    const referrerId = referrerDoc.id;
                    const currentCount = referrerDoc.data().referralCount || 0;

                    // A. Atomically update the referrer's count
                    await updateDoc(doc(db, "users", referrerId), {
                        referralCount: currentCount + 1,
                    });

                    // B. 🚨 NEW: Add the new user's UID to the referrer's 'team' subcollection
                    // This supports the new, stable method for fetching the referral list.
                    await setDoc(doc(db, "users", referrerId, "team", user.uid), {
                        memberId: user.uid,
                        fullName: fullName, // Save the new user's name for easy display
                        joinDate: serverTimestamp(),
                    });
                    
                    console.log(`Referral successful! Added user to team of ${referrerId}`);
                }
            }

            alert('Registration successful! You are now logged in.');

        } else {
            // --- LOGIN LOGIC ---
            
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged listener handles UI update
            
            alert('Login successful!');
        }
        
    } catch (error) {
        console.error("Authentication Error:", error);
        
        // Provide helpful feedback for common Firebase errors
        let errorMessage = 'An unknown authentication error occurred.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Try logging in.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email format.';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password.';
        }
        alert(errorMessage);
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

    // --- 2. Attach Navigation & Conditional Data Loading Listeners ---
    
    // Standard Footer Navigation (Home, Products, My products, My team, Me)
    navButtons.forEach((navButton, index) => {
        navButton.addEventListener('click', () => {
            const targetSectionName = sectionMap[index];

            showSection(targetSectionName);
            setActiveNav(navButton);
            window.scrollTo(0, 0); 
            
            // Conditional data loading based on the target section
            if (targetSectionName === 'my-products') {
                 loadMyProducts(); 
            } else if (targetSectionName === 'my-team') {
                 // Update the UI with referral code and team count
                 updateMyTeamUI(currentUserID); 
                 
                 // Fetch the user's code, then load the referral list
                 const userRef = doc(db, "users", currentUserID);
                 getDoc(userRef).then(snap => {
                     if (snap.exists()) {
                         loadReferralList(snap.data().referralCode);
                     }
                 });
            }
        });
    });

    // Recharge Form Navigation (from the 'Me' section menu)
    const rechargeLink = document.querySelector('.me-menu-list a[href="#recharge"]');
    if (rechargeLink) {
        rechargeLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('recharge-page'); 
            window.scrollTo(0, 0); 
            if (currentUserID) fetchAndDisplayBalance(currentUserID);
        });
    }
    
    // Withdrawal Form Navigation (from the 'Me' section menu)
    const withdrawalLink = document.querySelector('.me-menu-list a[href="#withdrawal"]'); 
    if (withdrawalLink) {
        withdrawalLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('withdrawal-page'); 
            window.scrollTo(0, 0); 
            if (currentUserID) fetchAndDisplayBalance(currentUserID);
        });
    }

    // 🚨 CONSOLIDATED ACTIVITY LOG NAVIGATION (Balance Bill / Activity / Earning Record)
    
    // Home Screen 'Activity' Button (Assuming href="#activity" or id="activity-log-trigger")
    const activityButton = document.getElementById('activity-log-trigger') || document.querySelector('.home-icons a[href="#activity"]'); 
    if (activityButton) {
        activityButton.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('activity-log-page'); 
            window.scrollTo(0, 0); 
            loadActivityLog(); 
        });
    }

    // Me Menu 'Balance bill' Link (Assuming href="#balance-bill")
    const balanceBillLink = document.querySelector('.me-menu-list a[href="#balance-bill"]'); 
    if (balanceBillLink) {
        balanceBillLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('activity-log-page'); 
            window.scrollTo(0, 0); 
            loadActivityLog(); 
        });
    }

    // Me Menu 'Recharge record' Link (Now redirects to consolidated log)
    const rechargeRecordLink = document.querySelector('.me-menu-list a[href="#recharge-records"]'); 
    if (rechargeRecordLink) {
        rechargeRecordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('activity-log-page'); 
            window.scrollTo(0, 0); 
            loadActivityLog(); 
        });
    }
    
    // Copy Referral Code Button
    const copyButton = document.getElementById('copy-referral-code');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const codeElement = document.getElementById('user-referral-code');
            // Assuming the text is available
            navigator.clipboard.writeText(codeElement.textContent) 
                .then(() => {
                    alert('Referral Code copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                });
        });
    }


    // --- 3. Attach Form Submission Handlers ---
    
    // Recharge Form Submission
    const rechargeForm = document.getElementById('recharge-form');
    if (rechargeForm) {
        rechargeForm.addEventListener('submit', handleRecharge);
    }
    
    // Withdrawal Form Submission
    const withdrawalForm = document.getElementById('withdrawal-form');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', handleWithdrawal);
    }
    
    // --- 4. Investment Button Listener (Event Delegation) ---
    const productsSection = document.querySelector('.Products');
    if (productsSection) {
        productsSection.addEventListener('click', (e) => {
            const investButton = e.target.closest('.invest-button'); 
            
            if (investButton) {
                e.preventDefault();

                const card = investButton.closest('.product-card'); 
                
                // Uses data attributes from HTML card element
                const productId = card ? card.dataset.productId : 'UNKNOWN_ID';
                const productName = card ? card.dataset.productName : 'Unknown Product';
                const price = card ? parseInt(card.dataset.price) : 0;
                const cycleDays = card ? parseInt(card.dataset.cycleDays) : 0;
                const dailyIncome = card ? parseInt(card.dataset.dailyIncome) : 0;

                handleInvestment(productId, productName, price, cycleDays, dailyIncome);
            }
        });
    }


    // --- 5. Firebase Authentication State Listener (Core UI Control) ---
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in.
            currentUserID = user.uid;
            console.log("User is logged in:", currentUserID);
            
            // Core Data Fetching on Login:
            updateMeSectionUI(user.uid); 
            fetchAndDisplayBalance(user.uid); 
            
            showAppContent(); 
        } else {
            // User is signed out.
            currentUserID = null;
            console.log("User is logged out.");
            
            fetchAndDisplayBalance(null); 
            
            showAuthScreen(); 
        }
    });

});


/** Fetches the full name from Firestore and updates the Me section UI. **/
async function updateMeSectionUI(uid) {
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

// script.js (Add this function)

async function handleWithdrawal(e) {
    e.preventDefault();

    if (!currentUserID) {
        alert("Please log in to make a withdrawal request.");
        return;
    }

    const amountInput = document.getElementById('withdrawal-amount');
    const payoutNumberInput = document.getElementById('payout-number');
    const submitBtn = document.getElementById('withdrawal-submit-btn');

    const amount = Number(amountInput.value);
    const payoutNumber = payoutNumberInput.value.trim();
    const minWithdrawal = 10000;

    if (amount < minWithdrawal) {
        alert(`Minimum withdrawal amount is UGX ${minWithdrawal.toLocaleString()}.`);
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Validating...";
    submitBtn.disabled = true;

    try {
        // 1. Get User's Current Balance (Read Operation)
        const userDocRef = doc(db, "users", currentUserID);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            throw new Error("User profile not found. Please re-login.");
        }
        
        const currentBalance = userDoc.data().balance || 0;

        // 2. Check for Sufficient Funds
        if (amount > currentBalance) {
            alert(`Insufficient funds. Your current balance is UGX ${currentBalance.toLocaleString()}.`);
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }

        // 3. Save the Withdrawal Request (Write Operation)
        submitBtn.textContent = "Submitting...";

        await addDoc(collection(db, "withdrawals"), {
            userId: currentUserID,
            amount: amount,
            method: "MTN Mobile Money",
            payoutNumber: payoutNumber,
            status: "Pending", // Status is pending until verified by admin
            requestDate: serverTimestamp() 
        });

        // NOTE: The actual balance deduction (atomic update) should happen when the admin APPROVES the withdrawal
        // For now, we only record the request.

        alert(`Withdrawal request of UGX ${amount.toLocaleString()} submitted successfully!`);
        document.getElementById('withdrawal-form').reset(); // Clear the form

    } catch (error) {
        console.error("Error submitting withdrawal request:", error);
        alert("Failed to submit withdrawal request: " + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function fetchAndDisplayBalance(uid) {
    if (!uid) {
        // If logged out, set all balances to 0 or N/A
        document.getElementById('user-current-balance').textContent = 'N/A';
        document.getElementById('user-withdrawable-balance').textContent = 'N/A';
        // Add more balance elements here as needed (e.g., in the 'Me' section summary)
        return;
    }

    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const balance = userData.balance || 0;
            const formattedBalance = balance.toLocaleString();
            
            // 🚨 Update Recharge Page Balance Display
            const rechargeBalanceElement = document.getElementById('user-current-balance');
            if (rechargeBalanceElement) {
                rechargeBalanceElement.textContent = formattedBalance;
            }

            // 🚨 Update Withdrawal Page Balance Display
            const withdrawalBalanceElement = document.getElementById('user-withdrawable-balance');
            if (withdrawalBalanceElement) {
                withdrawalBalanceElement.textContent = formattedBalance;
            }
            
            // 🚨 Update Me Section Balance Display (If you have a separate element there)
            // Example:
            const meBalanceElement = document.getElementById('me-section-balance'); 
            if (meBalanceElement) {
                meBalanceElement.textContent = formattedBalance;
            }

            console.log("Balance updated on UI:", balance);

        } else {
            console.warn("User document not found for balance display.");
        }
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

/** Handles the entire investment transaction: balance check, deduction, and record creation. **/
async function handleInvestment(productId, productName, investmentPrice, cycleDays, dailyIncome) {
    if (!currentUserID) {
        alert("Please log in to invest.");
        return;
    }

    try {
        const userRef = doc(db, "users", currentUserID);
        const transactionResult = await runTransaction(db, async (transaction) => {
            
            // 1. Read the current user's data within the transaction
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw "User document does not exist!";
            }

            const currentBalance = userDoc.data().balance || 0;
            const price = Number(investmentPrice);

            // 2. Validate sufficient funds
            if (currentBalance < price) {
                // Throw an error to stop the transaction and catch it below
                throw new Error("Insufficient funds. Please recharge your account.");
            }

            // 3. Deduct the price from the balance (Write 1)
            transaction.update(userRef, { 
                balance: increment(-price) // Use increment for atomic operation
            });

            // 4. Record the new investment in the 'investments' collection (Write 2)
            const totalIncome = dailyIncome * cycleDays; // Calculate total income
            const investmentRef = doc(collection(db, "investments"));
            transaction.set(investmentRef, {
                userId: currentUserID,
                productId: productId,
                productName: productName,
                investmentAmount: price,
                cycleDays: cycleDays,
                dailyIncome: dailyIncome,
                totalIncome: totalIncome,
                status: 'active', // Set status to active
                startDate: serverTimestamp(),
                daysProgress: 0,
            });

            return { newBalance: currentBalance - price };
        });

        // If transaction succeeds
        alert(`Successfully invested UGX ${investmentPrice.toLocaleString()} in ${productName}.`);
        
        // Update the UI after a successful transaction
        fetchAndDisplayBalance(currentUserID); 
        
    } catch (error) {
        // If transaction fails due to insufficient funds or Firebase error
        if (typeof error === 'string' && error.startsWith("User document")) {
            alert("Error: User profile missing.");
        } else if (error.message.includes("Insufficient funds")) {
            alert(error.message); // Display the custom error
        } else {
            console.error("Investment failed:", error);
            alert("Investment failed due to an error. Check console.");
        }
    }
}

// script.js (Add this function)

/** Fetches and displays the current user's deposit requests from the 'recharges' collection. **/
async function loadRechargeRecords() {
    const listContainer = document.getElementById('recharge-records-list');
    const noRecordsMessage = document.getElementById('no-recharge-records-message');
    
    // Clear previous content and show loading state
    listContainer.innerHTML = '<p class="loading-message">Loading deposit history...</p>';
    noRecordsMessage.style.display = 'none';

    if (!currentUserID) {
        listContainer.innerHTML = '<p class="error-message">Please log in to view your history.</p>';
        return;
    }

    try {
        // 1. Query the 'recharges' collection for documents belonging to the current user
        const rechargesRef = collection(db, "recharges");
        // Order by requestDate descending (newest first)
        const q = query(rechargesRef, 
                        where("userId", "==", currentUserID),
                        orderBy("requestDate", "desc")); 
        
        const querySnapshot = await getDocs(q);
        const records = [];
        
        querySnapshot.forEach((doc) => {
            records.push({ id: doc.id, ...doc.data() });
        });
        
        listContainer.innerHTML = ''; // Clear loading message

        if (records.length === 0) {
            noRecordsMessage.style.display = 'block';
            return;
        }

        // 2. Render each record as a list item or card
        records.forEach(record => {
            // Format the timestamp if it exists
            const date = record.requestDate ? 
                         new Date(record.requestDate.toDate()).toLocaleString() : 
                         'N/A';
            
            const statusClass = `status-${record.status.toLowerCase()}`;

            const recordHTML = `
                <div class="transaction-record ${statusClass}">
                    <p class="record-title">Deposit Request</p>
                    <div class="record-details">
                        <p><strong>Amount:</strong> UGX ${record.amount.toLocaleString()}</p>
                        <p><strong>Method:</strong> ${record.method}</p>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Status:</strong> <span class="record-status">${record.status.toUpperCase()}</span></p>
                    </div>
                </div>
            `;
            listContainer.innerHTML += recordHTML;
        });

    } catch (error) {
        console.error("Error loading recharge records:", error);
        listContainer.innerHTML = '<p class="error-message">Failed to load history. Check console.</p>';
    }
}

/** Fetches and displays all transaction types (Recharge, Withdrawal, Investment) into one log. **/
async function loadActivityLog() {
    const listContainer = document.getElementById('activity-log-list');
    const noRecordsMessage = document.getElementById('no-activity-records-message');
    
    listContainer.innerHTML = '<p class="loading-message">Loading all transaction history...</p>';
    noRecordsMessage.style.display = 'none';

    if (!currentUserID) {
        listContainer.innerHTML = '<p class="error-message">Please log in to view your activity.</p>';
        return;
    }

    try {
        const userId = currentUserID;
        let allTransactions = [];

        // --- 1. Fetch Recharge Records (Deposits) ---
        const rechargesSnapshot = await getDocs(query(collection(db, "recharges"), where("userId", "==", userId)));
        rechargesSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({ 
                type: 'Deposit', 
                amount: data.amount, 
                date: data.requestDate, 
                status: data.status,
                detail: `Mobile Money: ${data.momoNumber || 'N/A'}`
            });
        });

        // --- 2. Fetch Withdrawal Records ---
        const withdrawalsSnapshot = await getDocs(query(collection(db, "withdrawals"), where("userId", "==", userId)));
        withdrawalsSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({ 
                type: 'Withdrawal', 
                amount: -data.amount, // Negative for withdrawal
                date: data.requestDate, 
                status: data.status,
                detail: `To MM Number: ${data.payoutNumber || 'N/A'}`
            });
        });

        // --- 3. Fetch Investment Records (Purchases) ---
        const investmentsSnapshot = await getDocs(query(collection(db, "investments"), where("userId", "==", userId)));
        investmentsSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({ 
                type: 'Investment', 
                amount: -data.investmentAmount, // Negative for purchase
                date: data.startDate, 
                status: 'Completed', // Purchase is immediate
                detail: `Product: ${data.productName}`
            });
        });

        // --- 4. Sort and Render ---
        
        // Sort all transactions by date (newest first)
        allTransactions.sort((a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0));

        listContainer.innerHTML = ''; 

        if (allTransactions.length === 0) {
            noRecordsMessage.style.display = 'block';
            return;
        }

        allTransactions.forEach(record => {
            const amountClass = record.amount > 0 ? 'positive' : 'negative';
            const statusText = record.status.toUpperCase();
            const date = record.date ? new Date(record.date.toDate()).toLocaleString() : 'N/A';
            
            const recordHTML = `
                <div class="transaction-item ${record.type.toLowerCase()}">
                    <div class="transaction-icon ${record.type.toLowerCase()}"></div>
                    <div class="transaction-info">
                        <p class="transaction-title">${record.type} <span class="status-badge status-${statusText.toLowerCase()}">${statusText}</span></p>
                        <p class="transaction-detail">${record.detail}</p>
                        <p class="transaction-date">${date}</p>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        UGX ${record.amount.toLocaleString()}
                    </div>
                </div>
            `;
            listContainer.innerHTML += recordHTML;
        });

    } catch (error) {
        console.error("Error loading activity log:", error);
        listContainer.innerHTML = '<p class="error-message">Failed to load activity log. Check console.</p>';
    }
}

// script.js (Add this function)

/** Updates the 'My Team' header with the user's code and count. **/
async function updateMyTeamUI(userId) {
    if (!userId) return;

    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const code = userData.referralCode || 'N/A';
            const count = userData.referralCount || 0;

            document.getElementById('user-referral-code').textContent = code;
            document.getElementById('share-link-text').textContent = `https://yourapp.com/?ref=${code}`;
            document.getElementById('team-count').textContent = count;
        }
    } catch (error) {
        console.error("Error updating My Team UI:", error);
    }
}

// script.js (Add this function)

/** Fetches users who signed up using the current user's referral code. **/

async function loadReferralList() {
    const listContainer = document.getElementById('referral-list-container');
    
    // Clear previous content and show loading message
    listContainer.innerHTML = '<p class="loading-message">Fetching team...</p>';

    if (!currentUserID) {
        listContainer.innerHTML = '<p class="error-message">Please log in to view your team.</p>';
        return;
    }

    try {
        // 🚨 CRITICAL CHANGE: Query the 'team' subcollection under the current user's UID.
        // This relies on the simple and robust security rule: allow read: if request.auth.uid == userId;
        const teamRef = collection(db, "users", currentUserID, "team"); 
        
        const querySnapshot = await getDocs(teamRef);
        const referrals = [];
        
        querySnapshot.forEach((doc) => {
            referrals.push(doc.data());
        });
        
        listContainer.innerHTML = ''; 

        if (referrals.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #555;">You have not invited any friends yet.</p>';
            return;
        }

        // Render the list of referrals
        referrals.forEach((referral, index) => {
            const joinDate = referral.joinDate ? new Date(referral.joinDate.toDate()).toLocaleDateString() : 'N/A';
            
            const memberHTML = `
                <div class="team-member-item">
                    <div class="member-name-container">
                        <p class="member-index">#${index + 1}</p>
                        <p class="member-name">${referral.fullName || 'Anonymous User'}</p>
                    </div>
                    <p class="member-info">Joined: ${joinDate}</p>
                </div>
            `;
            listContainer.innerHTML += memberHTML;
        });

    } catch (error) {
        console.error("Error loading referral list:", error);
        listContainer.innerHTML = '<p class="error-message">Failed to load team data. Please ensure the security rules for the /users/{userId}/team subcollection are published correctly.</p>';
    }
}

// script.js (Utility Functions Section)

function getReferralCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    return refCode ? refCode.toUpperCase() : null; 
}
