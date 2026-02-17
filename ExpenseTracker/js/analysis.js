/**
 * Analysis Page - Firestore Version
 * Depends on common.js and firebase-config.js
 */

// Global unsubscribe function
let unsubscribeAnalysis = null;

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user || !db) {
        if (!db) {
            console.error('Firestore not initialized');
            alert('Database connection error. Please refresh the page.');
        }
        return;
    }

    loadAnalysisDataFromFirestore(user.uid);

    /**
     * Load analysis data from Firestore with real-time updates
     */
    function loadAnalysisDataFromFirestore(uid) {
        // Unsubscribe from previous listener
        if (unsubscribeAnalysis) {
            unsubscribeAnalysis();
        }

        const transactionsRef = db.collection('users').doc(uid).collection('transactions');

        // Subscribe to real-time updates
        unsubscribeAnalysis = transactionsRef
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

                renderAnalysis(transactions);
            }, (error) => {
                console.error('Error loading transactions for analysis:', error);
            });
    }

    /**
     * Render analysis charts and tables
     */
    function renderAnalysis(transactions) {
        // --- Prepare Data ---

        // 1. Category Data
        const categoryTotals = {};
        let totalExpense = 0;
        let totalIncome = 0;

        transactions.forEach(t => {
            if (t.type === 'expense') {
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + parseFloat(t.amount);
                totalExpense += parseFloat(t.amount);
            } else {
                totalIncome += parseFloat(t.amount);
            }
        });

        // 2. Trend Data (Last 6 Months)
        const months = [];
        const incomeTrend = [];
        const expenseTrend = [];

        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            months.push(monthYear);

            // Filter for this month
            const monthTxns = transactions.filter(t => {
                const tDate = t.date;
                return tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear();
            });

            const mIncome = monthTxns.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const mExpense = monthTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);

            incomeTrend.push(mIncome);
            expenseTrend.push(mExpense);
        }

        // --- Render Charts ---

        // Pie Chart
        const ctxPie = document.getElementById('categoryChart');
        // Destroy existing chart if it exists to prevent overlap
        const existingPie = Chart.getChart(ctxPie);
        if (existingPie) existingPie.destroy();

        if (ctxPie && totalExpense > 0) {
            new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categoryTotals),
                    datasets: [{
                        data: Object.values(categoryTotals),
                        backgroundColor: [
                            '#4cc9f0', '#4361ee', '#3f37c9', '#4895ef', '#f72585', '#7209b7', '#ffafcc', '#fee440'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        } else if (ctxPie) {
            // Clear canvas if no data
            const ctx = ctxPie.getContext('2d');
            ctx.clearRect(0, 0, ctxPie.width, ctxPie.height);
        }

        // Bar Chart
        const ctxBar = document.getElementById('trendsChart');
        const existingBar = Chart.getChart(ctxBar);
        if (existingBar) existingBar.destroy();

        if (ctxBar) {
            new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Income',
                            data: incomeTrend,
                            backgroundColor: '#4cc9f0',
                            borderRadius: 5
                        },
                        {
                            label: 'Expense',
                            data: expenseTrend,
                            backgroundColor: '#f72585',
                            borderRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { borderDash: [5, 5] }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        // --- Render Table ---
        const statsTable = document.getElementById('stats-table');
        if (statsTable) {
            statsTable.innerHTML = ''; // Clear previous
            const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

            if (sortedCats.length === 0) {
                statsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No data available.</td></tr>';
            }

            sortedCats.forEach(([cat, amount]) => {
                const percentage = ((amount / totalExpense) * 100).toFixed(1);
                const count = transactions.filter(t => t.type === 'expense' && t.category === cat).length;

                const row = `
                    <tr>
                        <td class="ps-4 fw-medium">${cat}</td>
                        <td>${formatCurrency(amount)}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <span class="me-2">${percentage}%</span>
                                <div class="progress flex-grow-1" style="height: 6px; width: 50px;">
                                    <div class="progress-bar bg-primary" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        </td>
                        <td>${count}</td>
                    </tr>
                `;
                statsTable.insertAdjacentHTML('beforeend', row);
            });
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeAnalysis) {
        unsubscribeAnalysis();
    }
});
