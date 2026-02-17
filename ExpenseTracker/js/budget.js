/**
 * Budget Management - Firestore Version
 * Depends on common.js and firebase-config.js
 */

// Global unsubscribe functions
let unsubscribeBudgets = null;
let unsubscribeTransactions = null;

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user || !db) {
        if (!db) {
            console.error('Firestore not initialized');
            alert('Database connection error. Please refresh the page.');
        }
        return;
    }

    const budgetForm = document.getElementById('budget-form');
    const budgetListEl = document.getElementById('budget-list');

    // Load Budgets with real-time updates
    loadBudgetsFromFirestore(user.uid);

    // Add Budget
    budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const period = document.getElementById('budget-period').value;
        const category = document.getElementById('budget-category').value;
        const limit = parseFloat(document.getElementById('budget-limit').value);

        if (isNaN(limit) || limit <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        const newBudget = {
            period: period,
            category: category,
            limit: limit
        };

        try {
            await addBudgetToFirestore(user.uid, newBudget);

            // Close Modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addBudgetModal'));
            modal.hide();
            budgetForm.reset();
        } catch (error) {
            alert('Failed to save budget. Please try again.');
        }
    });

    /**
     * Load budgets from Firestore with real-time updates
     */
    function loadBudgetsFromFirestore(uid) {
        // Unsubscribe from previous listeners
        if (unsubscribeBudgets) unsubscribeBudgets();
        if (unsubscribeTransactions) unsubscribeTransactions();

        // Subscribe to budgets
        unsubscribeBudgets = subscribeToBudgets(uid, (budgets) => {
            // Also subscribe to transactions for calculations
            const transactionsRef = db.collection('users').doc(uid).collection('transactions');
            unsubscribeTransactions = transactionsRef
                .where('deleted', '==', false)
                .onSnapshot((snapshot) => {
                    const transactions = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        transactions.push({
                            id: doc.id,
                            ...data,
                            // Convert Firestore timestamp to Date
                            date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
                        });
                    });

                    renderBudgets(budgets, transactions);
                });
        });
    }

    /**
     * Render budgets to the UI
     */
    function renderBudgets(budgets, transactions) {
        // Sorting: Monthly first, then others
        budgets.sort((a, b) => a.period.localeCompare(b.period));

        budgetListEl.innerHTML = '';

        let weeklyLimit = 0;
        let monthlyLimit = 0;
        let yearlyLimit = 0;

        // Calculate limits from specific 'All Expenses' budgets
        budgets.forEach(b => {
            if (b.category === 'All') {
                if (b.period === 'Weekly') weeklyLimit = b.limit;
                if (b.period === 'Monthly') monthlyLimit = b.limit;
                if (b.period === 'Yearly') yearlyLimit = b.limit;
            }
        });

        // Update Summary Cards
        document.getElementById('weekly-limit-display').textContent = formatCurrency(weeklyLimit);
        document.getElementById('monthly-limit-display').textContent = formatCurrency(monthlyLimit);
        document.getElementById('yearly-limit-display').textContent = formatCurrency(yearlyLimit);

        document.getElementById('weekly-status').textContent = weeklyLimit > 0 ? "Active weekly limit" : "No limit set";
        document.getElementById('monthly-status').textContent = monthlyLimit > 0 ? "Active monthly limit" : "No limit set";
        document.getElementById('yearly-status').textContent = yearlyLimit > 0 ? "Active yearly limit" : "No limit set";

        // Ensure text is white for better contrast
        document.getElementById('weekly-limit-display').classList.add('text-white');
        document.getElementById('monthly-limit-display').classList.add('text-white');
        document.getElementById('yearly-limit-display').classList.add('text-white');

        if (budgets.length === 0) {
            budgetListEl.innerHTML = `
                <div class="text-center py-5 text-muted bg-white rounded shadow-sm">
                    <i class="fa-solid fa-clipboard-list fa-3x mb-3 text-light"></i>
                    <p>No budgets set yet. Click "Set New Budget" to start.</p>
                </div>
            `;
            return;
        }

        budgets.forEach(b => {
            // Calculate Spent based on Period
            let spent = 0;
            const now = new Date();

            // Filter transactions based on period and category
            const relevantTxns = transactions.filter(t => {
                if (t.type !== 'expense') return false;
                if (b.category !== 'All' && t.category !== b.category) return false;

                const tDate = t.date;

                // Date Logic
                if (b.period === 'Weekly') {
                    // Check if in current week
                    const oneJan = new Date(now.getFullYear(), 0, 1);
                    const numberOfDays = Math.floor((now - oneJan) / (24 * 60 * 60 * 1000));
                    const currentWeek = Math.ceil((now.getDay() + 1 + numberOfDays) / 7);

                    const tNumberOfDays = Math.floor((tDate - oneJan) / (24 * 60 * 60 * 1000));
                    const tWeek = Math.ceil((tDate.getDay() + 1 + tNumberOfDays) / 7);

                    return tDate.getFullYear() === now.getFullYear() && tWeek === currentWeek;
                } else if (b.period === 'Monthly') {
                    return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
                } else if (b.period === 'Yearly') {
                    return tDate.getFullYear() === now.getFullYear();
                }
                return false;
            });

            spent = relevantTxns.reduce((sum, t) => sum + parseFloat(t.amount), 0);

            // Render Item
            const percentage = Math.min((spent / b.limit) * 100, 100);
            let colorClass = 'bg-primary';
            if (percentage > 50) colorClass = 'bg-warning';
            if (percentage > 90) colorClass = 'bg-danger';

            const html = `
                <div class="col-md-6 mb-3">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">   
                                <div>
                                    <span class="badge bg-light text-primary border me-2">${b.period}</span>
                                    <span class="fw-bold text-dark">${b.category === 'All' ? 'Total Expenses' : b.category}</span>
                                </div>
                                <button class="btn btn-sm text-danger opacity-50 hover-opacity-100" onclick="deleteBudget('${b.id}')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                            <div class="d-flex justify-content-between small text-muted mb-1">
                                <span>Spent: <strong class="text-dark">${formatCurrency(spent)}</strong></span>
                                <span>Limit: <strong class="text-dark">${formatCurrency(b.limit)}</strong></span>
                            </div>
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${percentage}%"></div>
                            </div>
                            ${spent > b.limit ? '<div class="text-danger small mt-2 fw-bold"><i class="fa-solid fa-circle-exclamation me-1"></i>Over Budget!</div>' : ''}
                        </div>
                    </div>
                </div>
             `;
            budgetListEl.insertAdjacentHTML('beforeend', html);
        });

        // Make budgetListEl a row for proper grid layout
        budgetListEl.classList.add('row');
    }

    /**
     * Delete budget from Firestore
     */
    window.deleteBudget = async function (id) {
        if (!confirm('Remove this budget?')) return;

        try {
            await deleteBudgetFromFirestore(user.uid, id);
        } catch (error) {
            alert('Failed to delete budget. Please try again.');
        }
    }

    /**
     * Clear all budgets from Firestore
     */
    window.clearAllBudgets = async function () {
        if (!confirm('Are you sure you want to delete ALL budget details? This cannot be undone.')) return;

        try {
            await clearAllBudgetsFromFirestore(user.uid);
        } catch (error) {
            alert('Failed to clear budgets. Please try again.');
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeBudgets) unsubscribeBudgets();
    if (unsubscribeTransactions) unsubscribeTransactions();
});
