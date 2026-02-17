/**
 * Common Utilities for AI Expense Tracker
 * Handles: Auth State, Currency Formatting, Navigation
 */

// Constants
const USERS_KEY = 'et_users';
const CURRENT_USER_KEY = 'et_current_user';
const DATA_PREFIX = 'et_data_';
const BUDGET_PREFIX = 'et_budget_';

// --- Auth Helpers ---

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
}

function updateCurrentUser(user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    // Also update in the main users list
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    const index = users.findIndex(u => u.uid === user.uid);
    if (index !== -1) {
        users[index] = user;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
}

async function logout() {
    try {
        if (window.auth) {
            await window.auth.signOut();
            console.log('✅ Signed out from Firebase');
        } else {
            console.warn('Auth object not found, clearing local session only.');
        }
        localStorage.removeItem(CURRENT_USER_KEY);
        window.location.href = 'index.html?msg=logged_out';
    } catch (error) {
        console.error('Logout failed:', error);
        // Force redirect anyway
        localStorage.removeItem(CURRENT_USER_KEY);
        window.location.href = 'index.html?msg=logged_out';
    }
}

function checkAuthState() {
    // ... (rest of checkAuthState is same, but let's just keep the function signature and not change body if not needed)
    const user = getCurrentUser();
    const path = window.location.pathname;
    const isPublic = path.endsWith('index.html') || path.endsWith('/');

    if (!user && !isPublic) {
        window.location.href = 'index.html';
    } else if (user && isPublic) {
        window.location.href = 'dashboard.html';
    }

    // Update User Name in Nav if exists
    const navUser = document.getElementById('user-display-name');
    if (navUser && user) {
        navUser.textContent = user.name;
    }
}

// --- Currency Formatter ---

function getCurrencyCode() {
    const user = getCurrentUser();
    return user && user.currency ? user.currency : 'INR';
}

function formatCurrency(amount) {
    const code = getCurrencyCode();
    // Default Locale Mapping
    const locales = {
        'INR': 'en-IN',
        'USD': 'en-US',
        'EUR': 'de-DE',
        'GBP': 'en-GB'
    };

    return new Intl.NumberFormat(locales[code] || 'en-US', {
        style: 'currency',
        currency: code
    }).format(amount);
}

// --- Date Formatter ---
function formatDate(date) {
    if (!date) return '';
    // Use 'en-IN' for DD/MM/YYYY format which is common in India (+05:30)
    // and unambiguous for international users compared to US format.
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    }).format(date);
}

function formatDateTime(date) {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(date);
}

// --- Data Helpers ---
function getDataKey(uid) {
    return DATA_PREFIX + uid;
}

function getBudgetKey(uid) {
    return BUDGET_PREFIX + uid;
}

// --- Toast Notification System ---

function showToast(message, type = 'primary') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '1100';
        document.body.appendChild(toastContainer);
    }

    // Colors based on type
    const bgClass = type === 'error' ? 'text-bg-danger' :
        type === 'success' ? 'text-bg-success' :
            type === 'warning' ? 'text-bg-warning' : 'text-bg-primary';

    // Create toast element
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgClass} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);

    // Initialize Bootstrap Toast
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();

    // Remove from DOM after hidden
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();

    // Cleanup legacy local storage 'et_users' if it exists (as requested)
    if (localStorage.getItem(USERS_KEY)) {
        console.log('🧹 Cleaning up legacy local users data...');
        localStorage.removeItem(USERS_KEY);
    }

    // Check for messages in URL (for redirect notifications)
    const urlParams = new URLSearchParams(window.location.search);
    const msg = urlParams.get('msg');

    if (msg === 'welcome') {
        const user = getCurrentUser();
        showToast(`Welcome back, ${user ? user.name : 'User'}!`, 'success');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (msg === 'logged_out') {
        showToast('You have been successfully logged out.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (msg === 'registered') {
        showToast('Account created successfully! Welcome aboard.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        // Remove old listeners by cloning
        const newBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Highlight Active Nav
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (path.includes(link.getAttribute('href'))) {
            link.classList.add('active');
        }
    });
});

// Export showToast globally
window.showToast = showToast;
