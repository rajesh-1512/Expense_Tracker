/**
 * Firebase Configuration and Initialization
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project or select existing project
 * 3. Click on "Web" icon to add Firebase to your web app
 * 4. Copy the firebaseConfig object and replace the placeholder below
 * 5. Enable Firestore Database in your Firebase console
 */

// TODO: REPLACE WITH YOUR FIREBASE CONFIG
// Get this from Firebase Console > Project Settings > Your apps > SDK setup and configuration
const firebaseConfig = {
    apiKey: "AIzaSyBtWe6O3QFRluV7su9bEnVFD8kUh3zIU34",
    authDomain: "personal-finance-advisor-d1012.firebaseapp.com",
    projectId: "personal-finance-advisor-d1012",
    storageBucket: "personal-finance-advisor-d1012.firebasestorage.app",
    messagingSenderId: "72771071045",
    appId: "1:72771071045:web:09ad828c8c67ffc465c72c",
    measurementId: "G-7MG1DQ9EN7"
};

// Initialize Firebase
let db = null;
let firebaseApp = null;

try {
    // Initialize Firebase App
    firebaseApp = firebase.initializeApp(firebaseConfig);

    // Initialize Firestore
    db = firebase.firestore();

    // Initialize Auth
    auth = firebase.auth();

    // Enable offline persistence for better UX
    db.enablePersistence()
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.warn('The current browser does not support offline persistence');
            }
        });

    // Listen for Auth State Changes
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user.email);

            // Get user details from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            let userData = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'User',
                photoURL: user.photoURL
            };

            if (userDoc.exists) {
                // Merge Firestore data
                const firestoreData = userDoc.data();
                userData = { ...userData, ...firestoreData };
                // Keep currency if exists
                if (!userData.currency) userData.currency = 'INR';
            }

            // Sync to localStorage for existing synchronous code
            localStorage.setItem('et_current_user', JSON.stringify(userData));

            // Update UI if on login page
            if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                window.location.href = 'dashboard.html?msg=welcome';
            }
        } else {
            // User is signed out
            console.log('User is signed out');
            localStorage.removeItem('et_current_user');

            // Redirect to login if not on public page
            const path = window.location.pathname;
            const isPublic = path.endsWith('index.html') || path.endsWith('/');
            if (!isPublic) {
                window.location.href = 'index.html';
            }
        }
    });

    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Firebase configuration error. Please check firebase-config.js and ensure you have added your Firebase credentials.');
}

/**
 * Helper function to get current user's UID from localStorage
 * @returns {string|null} User UID or null if not logged in
 */
function getCurrentUserUID() {
    const user = localStorage.getItem('et_current_user');
    if (user) {
        try {
            const userData = JSON.parse(user);
            return userData.uid;
        } catch (e) {
            console.error('Error parsing current user:', e);
            return null;
        }
    }
    return null;
}

/**
 * Sync user profile to Firestore
 * @param {Object} user - User object from localStorage
 */
async function syncUserToFirestore(user) {
    if (!db || !user || !user.uid) return;

    try {
        const userRef = db.collection('users').doc(user.uid);

        // Update or create user document
        await userRef.set({
            name: user.name || '',
            email: user.email || '',
            currency: user.currency || 'INR',
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('✅ User profile synced to Firestore');
    } catch (error) {
        console.error('❌ Error syncing user to Firestore:', error);
    }
}

/**
 * Update user preferences in Firestore
 * @param {string} uid - User ID
 * @param {Object} data - Data to update
 */
async function updateUserPreferences(uid, data) {
    if (!db || !uid) return;

    try {
        const userRef = db.collection('users').doc(uid);
        await userRef.update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ User preferences updated in Firestore');
    } catch (error) {
        console.error('❌ Error updating user preferences:', error);
        throw error;
    }
}

/**
 * Add budget to Firestore
 * @param {string} uid - User ID
 * @param {Object} budgetData - Budget data (period, category, limit)
 */
async function addBudgetToFirestore(uid, budgetData) {
    if (!db || !uid) return;

    try {
        const budgetsRef = db.collection('users').doc(uid).collection('budgets');

        // Check if budget already exists for same period + category
        const existingQuery = await budgetsRef
            .where('period', '==', budgetData.period)
            .where('category', '==', budgetData.category)
            .get();

        // If exists, update instead of creating duplicate
        if (!existingQuery.empty) {
            const docId = existingQuery.docs[0].id;
            await budgetsRef.doc(docId).update({
                limit: budgetData.limit,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Budget updated in Firestore');
        } else {
            // Create new budget
            await budgetsRef.add({
                period: budgetData.period,
                category: budgetData.category,
                limit: budgetData.limit,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Budget added to Firestore');
        }
    } catch (error) {
        console.error('❌ Error adding budget to Firestore:', error);
        throw error;
    }
}

/**
 * Subscribe to budgets with real-time updates
 * @param {string} uid - User ID
 * @param {Function} callback - Callback function to handle budget updates
 * @returns {Function} Unsubscribe function
 */
function subscribeToBudgets(uid, callback) {
    if (!db || !uid) return () => { };

    const budgetsRef = db.collection('users').doc(uid).collection('budgets');

    return budgetsRef.onSnapshot((snapshot) => {
        const budgets = [];
        snapshot.forEach((doc) => {
            budgets.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(budgets);
    }, (error) => {
        console.error('❌ Error loading budgets:', error);
        callback([]);
    });
}

/**
 * Delete budget from Firestore
 * @param {string} uid - User ID
 * @param {string} budgetId - Budget document ID
 */
async function deleteBudgetFromFirestore(uid, budgetId) {
    if (!db || !uid || !budgetId) return;

    try {
        const budgetRef = db.collection('users').doc(uid).collection('budgets').doc(budgetId);
        await budgetRef.delete();
        console.log('✅ Budget deleted from Firestore');
    } catch (error) {
        console.error('❌ Error deleting budget:', error);
        throw error;
    }
}

/**
 * Clear all budgets from Firestore
 * @param {string} uid - User ID
 */
async function clearAllBudgetsFromFirestore(uid) {
    if (!db || !uid) return;

    try {
        const budgetsRef = db.collection('users').doc(uid).collection('budgets');
        const snapshot = await budgetsRef.get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('✅ All budgets cleared from Firestore');
    } catch (error) {
        console.error('❌ Error clearing budgets:', error);
        throw error;
    }
}

/**
 * Add recurring expense to Firestore
 * @param {string} uid - User ID
 * @param {Object} expenseData - Recurring expense data
 */
async function addRecurringExpenseToFirestore(uid, expenseData) {
    if (!db || !uid) return;

    try {
        const recurringRef = db.collection('users').doc(uid).collection('recurringExpenses');
        await recurringRef.add({
            ...expenseData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Recurring expense added to Firestore');
    } catch (error) {
        console.error('❌ Error adding recurring expense:', error);
        throw error;
    }
}

/**
 * Subscribe to recurring expenses with real-time updates
 * @param {string} uid - User ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
function subscribeToRecurringExpenses(uid, callback) {
    if (!db || !uid) return () => { };

    const recurringRef = db.collection('users').doc(uid).collection('recurringExpenses');

    return recurringRef.onSnapshot((snapshot) => {
        const expenses = [];
        snapshot.forEach((doc) => {
            expenses.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(expenses);
    }, (error) => {
        console.error('❌ Error loading recurring expenses:', error);
        callback([]);
    });
}

/**
 * Delete recurring expense from Firestore
 * @param {string} uid - User ID
 * @param {string} expenseId - Expense document ID
 */
async function deleteRecurringExpenseFromFirestore(uid, expenseId) {
    if (!db || !uid || !expenseId) return;

    try {
        const expenseRef = db.collection('users').doc(uid).collection('recurringExpenses').doc(expenseId);
        await expenseRef.delete();
        console.log('✅ Recurring expense deleted from Firestore');
    } catch (error) {
        console.error('❌ Error deleting recurring expense:', error);
        throw error;
    }
}

/**
 * Clear all recurring expenses from Firestore
 * @param {string} uid - User ID
 */
async function clearAllRecurringExpensesFromFirestore(uid) {
    if (!db || !uid) return;

    try {
        const recurringRef = db.collection('users').doc(uid).collection('recurringExpenses');
        const snapshot = await recurringRef.get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('✅ All recurring expenses cleared from Firestore');
    } catch (error) {
        console.error('❌ Error clearing recurring expenses:', error);
        throw error;
    }
}

/**
 * Clear all transactions from Firestore (Hard Delete)
 * @param {string} uid - User ID
 */
async function clearAllTransactionsFromFirestore(uid) {
    if (!db || !uid) return;

    try {
        const transactionsRef = db.collection('users').doc(uid).collection('transactions');
        const snapshot = await transactionsRef.get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('✅ All transactions permanently deleted from Firestore');
    } catch (error) {
        console.error('❌ Error clearing transactions:', error);
        throw error;
    }
}

// Export for use in other files
window.db = db;
window.auth = auth;
window.firebaseApp = firebaseApp;
window.getCurrentUserUID = getCurrentUserUID;
window.syncUserToFirestore = syncUserToFirestore;
window.updateUserPreferences = updateUserPreferences;
window.addBudgetToFirestore = addBudgetToFirestore;
window.subscribeToBudgets = subscribeToBudgets;
window.deleteBudgetFromFirestore = deleteBudgetFromFirestore;
window.clearAllBudgetsFromFirestore = clearAllBudgetsFromFirestore;
window.addRecurringExpenseToFirestore = addRecurringExpenseToFirestore;
window.subscribeToRecurringExpenses = subscribeToRecurringExpenses;
window.deleteRecurringExpenseFromFirestore = deleteRecurringExpenseFromFirestore;
window.clearAllRecurringExpensesFromFirestore = clearAllRecurringExpensesFromFirestore;
window.clearAllTransactionsFromFirestore = clearAllTransactionsFromFirestore;
