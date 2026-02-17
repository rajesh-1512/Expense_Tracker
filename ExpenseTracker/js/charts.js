let expenseChartInstance = null;

function updateExpenseChart(data) {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    const labels = Object.keys(data);
    const values = Object.values(data);

    // Aesthetic Colors
    const backgroundColors = [
        '#4cc9f0', // Light Blue
        '#4361ee', // Primary Blue
        '#3f37c9', // Dark Blue
        '#4895ef', // Accent Blue
        '#f72585', // Pink
        '#7209b7', // Purple
        '#ffafcc', // Light Pink
        '#fee440'  // Yellow
    ];

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: values,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        font: {
                            family: 'Outfit'
                        }
                    }
                }
            },
            cutout: '70%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}
