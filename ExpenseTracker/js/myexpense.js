/**
 * MyExpense - Recurring Expenses Management
 * Depends on common.js and firebase-config.js
 */

// Global unsubscribe function
let unsubscribeRecurring = null;

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user || !db) {
        if (!db) {
            console.error('Firestore not initialized');
            alert('Database connection error. Please refresh the page.');
        }
        return;
    }

    const recurringForm = document.getElementById('recurring-form');
    const recurringListEl = document.getElementById('recurring-list');

    // Load Recurring Expenses with real-time updates
    loadRecurringExpensesFromFirestore(user.uid);

    // Add Recurring Expense
    recurringForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('recurring-name').value;
        const category = document.getElementById('recurring-category').value;
        const amount = parseFloat(document.getElementById('recurring-amount').value);
        const frequency = document.getElementById('recurring-frequency').value;

        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        const newRecurring = {
            name: name,
            category: category,
            amount: amount,
            frequency: frequency
        };

        try {
            await addRecurringExpenseToFirestore(user.uid, newRecurring);

            // Close Modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRecurringModal'));
            modal.hide();
            recurringForm.reset();
        } catch (error) {
            alert('Failed to save recurring expense. Please try again.');
        }
    });

    /**
     * Load recurring expenses from Firestore with real-time updates
     */
    function loadRecurringExpensesFromFirestore(uid) {
        // Unsubscribe from previous listener
        if (unsubscribeRecurring) unsubscribeRecurring();

        // Subscribe to recurring expenses
        unsubscribeRecurring = subscribeToRecurringExpenses(uid, (expenses) => {
            renderRecurringExpenses(expenses);
        });
    }

    /**
     * Render recurring expenses to the UI
     */
    function renderRecurringExpenses(expenses) {
        recurringListEl.innerHTML = '';

        // Calculate totals
        let weeklyTotal = 0;
        let monthlyTotal = 0;
        let yearlyTotal = 0;
        let weeklyCount = 0;
        let monthlyCount = 0;
        let yearlyCount = 0;

        expenses.forEach(e => {
            if (e.frequency === 'Weekly') {
                weeklyTotal += e.amount;
                weeklyCount++;
            } else if (e.frequency === 'Monthly') {
                monthlyTotal += e.amount;
                monthlyCount++;
            } else if (e.frequency === 'Yearly') {
                yearlyTotal += e.amount;
                yearlyCount++;
            }
        });

        // Update Summary Cards
        document.getElementById('weekly-recurring-total').textContent = formatCurrency(weeklyTotal);
        document.getElementById('monthly-recurring-total').textContent = formatCurrency(monthlyTotal);
        document.getElementById('yearly-recurring-total').textContent = formatCurrency(yearlyTotal);

        document.getElementById('weekly-recurring-count').textContent = `${weeklyCount} expense${weeklyCount !== 1 ? 's' : ''}`;
        document.getElementById('monthly-recurring-count').textContent = `${monthlyCount} expense${monthlyCount !== 1 ? 's' : ''}`;
        document.getElementById('yearly-recurring-count').textContent = `${yearlyCount} expense${yearlyCount !== 1 ? 's' : ''}`;

        if (expenses.length === 0) {
            recurringListEl.innerHTML = `
                <div class="text-center py-5 text-muted bg-white rounded shadow-sm">
                    <i class="fa-solid fa-repeat fa-3x mb-3 text-light"></i>
                    <p>No recurring expenses set yet. Click "Add Recurring Expense" to start.</p>
                </div>
            `;
            return;
        }

        // Sort by frequency (Monthly first, then Weekly, then Yearly)
        const frequencyOrder = { 'Monthly': 1, 'Weekly': 2, 'Yearly': 3 };
        expenses.sort((a, b) => frequencyOrder[a.frequency] - frequencyOrder[b.frequency]);

        // Create a row container
        recurringListEl.classList.add('row');

        expenses.forEach(e => {
            // Determine badge color
            let badgeClass = 'bg-primary';
            let iconClass = 'fa-calendar-days';
            if (e.frequency === 'Weekly') {
                badgeClass = 'bg-warning';
                iconClass = 'fa-calendar-week';
            } else if (e.frequency === 'Yearly') {
                badgeClass = 'bg-info';
                iconClass = 'fa-calendar';
            }

            const html = `
                <div class="col-md-6 mb-3">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="flex-grow-1">
                                    <div class="d-flex align-items-center mb-2">
                                        <i class="fa-solid ${iconClass} text-muted me-2"></i>
                                        <h6 class="fw-bold mb-0">${escapeHtml(e.name)}</h6>
                                    </div>
                                    <span class="badge ${badgeClass} me-2">${e.frequency}</span>
                                    <span class="badge bg-light text-dark border">${escapeHtml(e.category)}</span>
                                </div>
                                <button class="btn btn-sm text-danger opacity-50 hover-opacity-100" onclick="deleteRecurring('${e.id}')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                            <div class="mt-3 pt-3 border-top">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="text-muted small">Amount</span>
                                    <h5 class="fw-bold mb-0 text-danger">${formatCurrency(e.amount)}</h5>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            recurringListEl.insertAdjacentHTML('beforeend', html);
        });
    }

    /**
     * Delete recurring expense from Firestore
     */
    window.deleteRecurring = async function (id) {
        if (!confirm('Remove this recurring expense?')) return;

        try {
            await deleteRecurringExpenseFromFirestore(user.uid, id);
        } catch (error) {
            alert('Failed to delete recurring expense. Please try again.');
        }
    }

    /**
     * Clear all recurring expenses from Firestore
     */
    window.clearAllRecurring = async function () {
        if (!confirm('Are you sure you want to delete ALL recurring expenses? This cannot be undone.')) return;

        try {
            await clearAllRecurringExpensesFromFirestore(user.uid);
        } catch (error) {
            alert('Failed to clear recurring expenses. Please try again.');
        }
    }
});

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
    if (unsubscribeRecurring) {
        unsubscribeRecurring();
    }
});
