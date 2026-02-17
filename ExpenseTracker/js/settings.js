document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user) return;

    const nameInput = document.getElementById('settings-name');
    const emailInput = document.getElementById('settings-email');
    const currencySelect = document.getElementById('settings-currency');
    const profileForm = document.getElementById('profile-form');
    const preferencesForm = document.getElementById('preferences-form');
    const deleteBtn = document.getElementById('delete-data-btn');

    // Load Data
    nameInput.value = user.name || '';
    emailInput.value = user.email || '';
    currencySelect.value = user.currency || 'INR';

    // Update Profile
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        user.name = nameInput.value.trim();
        updateCurrentUser(user);

        // Sync to Firestore
        if (window.syncUserToFirestore) {
            await window.syncUserToFirestore(user);
        }

        alert('Profile updated successfully!');
        window.location.reload();
    });

    // Update Preferences
    preferencesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        user.currency = currencySelect.value;
        updateCurrentUser(user);

        // Sync to Firestore
        if (window.updateUserPreferences) {
            await window.updateUserPreferences(user.uid, { currency: user.currency });
        }

        alert('Preferences saved! Dashboard and specific pages will now use ' + user.currency);
    });

    // Delete Data
    deleteBtn.addEventListener('click', async () => {
        const confirmText = "Are you sure? This will PERMANENTLY delete all your recorded transactions, budgets, and recurring expenses from the database. This cannot be undone.";
        if (confirm(confirmText)) {
            const originalText = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
            deleteBtn.disabled = true;

            try {
                // 1. Clear LocalStorage (Legacy)
                const dataKey = getDataKey(user.uid);
                const budgetKey = getBudgetKey(user.uid);
                localStorage.removeItem(dataKey);
                localStorage.removeItem(budgetKey);

                // 2. Clear Firestore Data
                const promises = [];

                if (window.clearAllTransactionsFromFirestore) {
                    promises.push(window.clearAllTransactionsFromFirestore(user.uid));
                }
                if (window.clearAllBudgetsFromFirestore) {
                    promises.push(window.clearAllBudgetsFromFirestore(user.uid));
                }
                if (window.clearAllRecurringExpensesFromFirestore) {
                    promises.push(window.clearAllRecurringExpensesFromFirestore(user.uid));
                }

                await Promise.all(promises);

                alert('All data has been permanently wiped from the database.');
                window.location.reload();
            } catch (error) {
                console.error('Error deleting data:', error);
                alert('An error occurred while deleting data. Please check the console.');
                deleteBtn.innerHTML = originalText;
                deleteBtn.disabled = false;
            }
        }
    });
});
