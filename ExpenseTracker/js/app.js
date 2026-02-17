/**
 * Main Application Logic - Firestore Version
 * Depends on common.js and firebase-config.js
 */

// Global Elements
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const balanceEl = document.getElementById('balance');
const savingsRateEl = document.getElementById('savings-rate');
const clearAllBtn = document.getElementById('clear-all-btn');

// Firestore unsubscribe function
let unsubscribeTransactions = null;

document.addEventListener('DOMContentLoaded', () => {
    // Only run on dashboard
    if (!window.location.pathname.includes('dashboard.html')) return;

    const user = getCurrentUser();
    if (user && db) {
        initializeDashboard(user);
    } else if (!db) {
        console.error('Firestore not initialized. Please check firebase-config.js');
        alert('Database connection error. Please refresh the page.');
    }
});

function initializeDashboard(user) {
    // Load data from Firestore with real-time updates
    loadDataFromFirestore(user.uid);

    // Add Transaction Listener
    if (transactionForm) {
        // Remove existing listeners to avoid duplicates
        const newForm = transactionForm.cloneNode(true);
        transactionForm.parentNode.replaceChild(newForm, transactionForm);

        // Re-select
        const activeForm = document.getElementById('transaction-form');

        activeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('type').value;
            const description = document.getElementById('description').value;
            const amountInput = document.getElementById('amount');
            const amount = parseFloat(amountInput.value);
            const category = document.getElementById('category').value;
            const dateInput = document.getElementById('date');
            const date = dateInput.valueAsDate || new Date();

            if (isNaN(amount) || amount <= 0) {
                alert("Please enter a valid amount");
                return;
            }

            await addTransactionToFirestore(user.uid, {
                type,
                description,
                amount,
                category,
                date: firebase.firestore.Timestamp.fromDate(date)
            });

            // Reset form
            activeForm.reset();
            if (dateInput) dateInput.valueAsDate = new Date();

            // AI Prompt
            if (type === 'expense' && amount > 100) {
                // Check if AI is available
                if (typeof askAI === 'function') {
                    askAI(`I just spent ${formatCurrency(amount)} on ${category}. Is this too much?`);
                }
            }
        });
    }

    // Clear All Listener
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            if (confirm("Are you sure? This will delete ALL history.")) {
                await clearAllTransactions(user.uid);
            }
        });
    }

    // Set default date
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.valueAsDate = new Date();
}

/**
 * Load transactions from Firestore with real-time updates
 */
function loadDataFromFirestore(uid) {
    if (!db) return;

    // Unsubscribe from previous listener if exists
    if (unsubscribeTransactions) {
        unsubscribeTransactions();
    }

    const transactionsRef = db.collection('users').doc(uid).collection('transactions');

    // Subscribe to real-time updates - filter out deleted transactions
    unsubscribeTransactions = transactionsRef
        .where('deleted', '==', false)  // Only show non-deleted transactions
        .onSnapshot((snapshot) => {
            const transactions = [];
            snapshot.forEach((doc) => {
                transactions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            renderTransactions(transactions);
        }, (error) => {
            console.error('Error loading transactions:', error);
            alert('Error loading data. Please refresh the page.');
        });
}

/**
 * Render transactions to the UI
 */
function renderTransactions(transactions) {
    // Calculate Totals
    let income = 0;
    let expense = 0;
    let categoriesData = {};

    if (transactionList) {
        transactionList.innerHTML = '';
        if (transactions.length === 0) {
            transactionList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No transactions found.</td></tr>';
        }
    }

    // Sort by date desc
    transactions.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
    });

    transactions.forEach(t => {
        // Totals
        const val = parseFloat(t.amount);
        if (t.type === 'income') {
            income += val;
        } else {
            expense += val;
            categoriesData[t.category] = (categoriesData[t.category] || 0) + val;
        }

        // Render Row
        if (transactionList) {
            const row = document.createElement('tr');
            const transactionDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);

            row.innerHTML = `
                <td class="ps-4 text-muted small">${formatDate(transactionDate)}</td>
                <td class="fw-medium">${escapeHtml(t.description)}</td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(t.category)}</span></td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'} fw-bold">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(val)}
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-link text-danger delete-btn" data-transaction-id="${t.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

            // Add delete event listener
            const deleteBtn = row.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async () => {
                const user = getCurrentUser();
                if (user) {
                    await deleteTransactionFromFirestore(user.uid, t.id);
                }
            });

            transactionList.appendChild(row);
        }
    });

    // Update UI Totals
    const balance = income - expense;
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(income);
    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(expense);
    if (balanceEl) balanceEl.textContent = formatCurrency(balance);

    if (savingsRateEl) {
        const rate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;
        savingsRateEl.textContent = `${rate}%`;
    }

    // Update Chart
    if (typeof updateExpenseChart === 'function') {
        updateExpenseChart(categoriesData);
    }
}

/**
 * Add transaction to Firestore
 */
async function addTransactionToFirestore(uid, transaction) {
    if (!db) return;

    try {
        const transactionsRef = db.collection('users').doc(uid).collection('transactions');
        await transactionsRef.add({
            ...transaction,
            deleted: false,  // Mark as not deleted
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Transaction added to Firestore');
    } catch (error) {
        console.error('❌ Error adding transaction:', error);
        alert('Failed to save transaction. Please try again.');
    }
}

/**
 * Soft delete transaction from Firestore (marks as deleted, doesn't remove)
 */
async function deleteTransactionFromFirestore(uid, transactionId) {
    if (!db) return;
    if (!confirm("Delete this record?")) return;

    try {
        const transactionRef = db.collection('users').doc(uid).collection('transactions').doc(transactionId);

        // Soft delete: mark as deleted instead of removing
        await transactionRef.update({
            deleted: true,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Transaction marked as deleted in Firestore (soft delete)');
    } catch (error) {
        console.error('❌ Error deleting transaction:', error);
        alert('Failed to delete transaction. Please try again.');
    }
}

/**
 * Soft delete all transactions from Firestore (marks all as deleted)
 */
async function clearAllTransactions(uid) {
    if (!db) return;

    try {
        const transactionsRef = db.collection('users').doc(uid).collection('transactions');
        const snapshot = await transactionsRef.where('deleted', '==', false).get();

        const batch = db.batch();
        const deletedAt = firebase.firestore.FieldValue.serverTimestamp();

        snapshot.docs.forEach((doc) => {
            // Soft delete: mark as deleted instead of removing
            batch.update(doc.ref, {
                deleted: true,
                deletedAt: deletedAt
            });
        });

        await batch.commit();
        console.log('✅ All transactions marked as deleted in Firestore (soft delete)');
    } catch (error) {
        console.error('❌ Error clearing transactions:', error);
        alert('Failed to clear transactions. Please try again.');
    }
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeTransactions) {
        unsubscribeTransactions();
    }
});
