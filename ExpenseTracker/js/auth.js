/**
 * Auth Logic - Firebase Version
 * Depends on common.js and firebase-config.js
 */

// DOM Elements
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const loginFormContainer = document.getElementById('login-form');
const registerFormContainer = document.getElementById('register-form');
const authAlert = document.getElementById('auth-alert');

// Toggle between Login and Register
if (showRegisterLink && showLoginLink) {
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('d-none');
        registerFormContainer.classList.remove('d-none');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('d-none');
        loginFormContainer.classList.remove('d-none');
    });
}

// Register User
if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const name = document.getElementById('reg-name').value.trim();

        if (!email || !password || !name) {
            showAlert('Please fill in all fields.', 'danger');
            return;
        }

        try {
            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update Profile Name
            await user.updateProfile({
                displayName: name
            });

            // Create User Document in Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                currency: 'INR',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            showAlert('Account created! Redirecting...', 'success');
            // Redirect is handled by onAuthStateChanged in firebase-config.js

        } catch (error) {
            console.error('Registration Error:', error);
            let message = 'Registration failed.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'Email is already registered.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password should be at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address.';
            }
            showAlert(message, 'danger');
        }
    });
}

// Login User
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showAlert('Please enter email and password.', 'danger');
            return;
        }

        try {
            // Sign in with Firebase Auth
            await auth.signInWithEmailAndPassword(email, password);

            // Update last login in Firestore
            if (auth.currentUser) {
                await db.collection('users').doc(auth.currentUser.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(err => console.log('New user or error updating last login', err));
            }

            showAlert('Login successful! Redirecting...', 'success');
            // Redirect is handled by onAuthStateChanged but we can force it here for immediate feedback if needed
            // But firebase-config.js handles it. 
            // To pass the message, we rely on firebase-config.js redirect logic OR we update it there.
            // Wait, firebase-config.js does the redirect.
            // I should update firebase-config.js redirect logic instead.


        } catch (error) {
            console.error('Login Error:', error);
            let message = 'Login failed.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = 'Invalid email or password.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many failed attempts. Please try again later.';
            }
            showAlert(message, 'danger');
        }
    });
}

function showAlert(message, type) {
    if (authAlert) {
        authAlert.textContent = message;
        authAlert.className = `alert alert-${type} mt-3`;
        authAlert.classList.remove('d-none');
        setTimeout(() => authAlert.classList.add('d-none'), 3000);
    }
}
