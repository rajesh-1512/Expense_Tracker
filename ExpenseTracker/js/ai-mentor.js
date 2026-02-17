/**
 * AI Mentor Logic
 * Features: Real-time Firestore Data Analysis, Chat History Persistence
 */

const chatWindow = document.getElementById('ai-chat-window');
const aiInput = document.getElementById('ai-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');

const CHAT_HISTORY_KEY = 'et_chat_history_';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
});

// --- Chat History Management ---

function getChatKey() {
    const user = getCurrentUser();
    return user ? CHAT_HISTORY_KEY + user.uid : null;
}

function loadChatHistory() {
    const key = getChatKey();
    if (!key) return;

    try {
        const history = JSON.parse(localStorage.getItem(key)) || [];
        // Clear default welcome message if history exists
        if (history.length > 0) {
            chatWindow.innerHTML = '';
            history.forEach(msg => {
                appendMessageToUI(msg.text, msg.sender, false, msg.timestamp); // Pass timestamp
            });
            // Scroll to bottom
            setTimeout(() => chatWindow.scrollTop = chatWindow.scrollHeight, 100);
        }
    } catch (e) {
        console.error('Error loading chat history:', e);
    }
}

function saveMessage(text, sender, timestamp) {
    const key = getChatKey();
    if (!key) return;

    const history = JSON.parse(localStorage.getItem(key)) || [];
    history.push({ text, sender, timestamp: timestamp || new Date().toISOString() });
    // Limit history to last 50 messages to save space
    if (history.length > 50) history.shift();

    localStorage.setItem(key, JSON.stringify(history));
}

function clearChatHistory() {
    const key = getChatKey();
    if (key) localStorage.removeItem(key);

    // Reset UI
    chatWindow.innerHTML = `
        <div class="text-center text-muted my-5">
            <div class="mb-3">
                <i class="fa-solid fa-comments-dollar fa-3x text-primary opacity-25"></i>
            </div>
            <h5>Chat Cleared.</h5>
            <p>Start a new conversation with your AI Mentor.</p>
        </div>
    `;
    if (window.showToast) window.showToast('Chat history cleared.', 'success');
}

if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat history?')) {
            clearChatHistory();
        }
    });
}

// --- UI Functions ---

function showTyping() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'chat-ai chat-bubble fst-italic text-muted';
    div.id = id;
    div.innerHTML = '<i class="fa-solid fa-ellipsis fa-fade"></i> AI is thinking...';
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return id;
}

function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function appendMessage(text, sender) {
    appendMessageToUI(text, sender, true);
}

function appendMessageToUI(text, sender, save = true, timestamp = null) {
    // If it's the first message and the "Welcome" screen is visible, clear it
    if (chatWindow.querySelector('.text-center.text-muted.my-5')) {
        chatWindow.innerHTML = '';
    }

    const div = document.createElement('div');
    div.className = `chat-bubble chat-${sender}`;
    // Parse Markdown if AI
    if (sender === 'ai') {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }

    // Add Timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-end small opacity-50 mt-1';
    timeDiv.style.fontSize = '0.7em';
    const msgDate = timestamp ? new Date(timestamp) : new Date();
    timeDiv.textContent = formatDateTime(msgDate);
    div.appendChild(timeDiv);

    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    if (save) {
        saveMessage(text, sender, msgDate.toISOString());
    }
}

// --- AI Logic ---

async function getFinancialContext() {
    const user = getCurrentUser();
    if (!user || !db) return "User data not available.";

    try {
        // Fetch transactions directly from Firestore
        // Note: We fetch all non-deleted transactions and sort client-side to avoid needing a composite index
        // which would require the user to manually create it in Firebase Console.
        const snapshot = await db.collection('users').doc(user.uid).collection('transactions')
            // .where('deleted', '==', false) // Even this might fail if 'deleted' field is missing on old docs
            .get();

        let income = 0;
        let expense = 0;
        let allTransactions = [];
        let catBreakdown = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            // Client-side filter for deleted
            if (data.deleted === true) return;

            const amount = parseFloat(data.amount) || 0;
            const date = data.date && data.date.toDate ? data.date.toDate() : new Date(data.date || Date.now());

            allTransactions.push({
                ...data,
                amount,
                dateObj: date
            });

            if (data.type === 'income') {
                income += amount;
            } else {
                expense += amount;
                if (data.category) {
                    catBreakdown[data.category] = (catBreakdown[data.category] || 0) + amount;
                }
            }
        });

        // Top Expenses
        const topCategories = Object.entries(catBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`)
            .join(', ');

        // Recent Transactions (Client-side Sort)
        allTransactions.sort((a, b) => b.dateObj - a.dateObj);

        const recentTransactions = allTransactions.slice(0, 20).map(t =>
            `${formatDate(t.dateObj)}: ${t.description} (${t.category}) - ${t.type == 'income' ? '+' : '-'}${formatCurrency(t.amount)}`
        );

        return `
        Financial Snapshot:
        - Total Income: ${formatCurrency(income)}
        - Total Expense: ${formatCurrency(expense)}
        - Current Balance: ${formatCurrency(income - expense)}
        - Top Expense Categories: ${topCategories || 'None'}
        - Recent Transactions:
        ${recentTransactions.join('\n')}
        `;

    } catch (error) {
        console.error("Error fetching financial context:", error);
        return "Error fetching financial data.";
    }
}

async function askAI(query) {
    if (!query && aiInput.value.trim() === "") return;

    const userMessage = query || aiInput.value.trim();
    if (!query) aiInput.value = '';

    appendMessage(userMessage, 'user');
    const typingId = showTyping();

    try {
        const financialData = await getFinancialContext();

        const systemPrompt = `
        You are a wise and encouraging Personal Finance Mentor.
        
        ${financialData}
        
        Provide helpful, short, and actionable financial advice based on the REAL data provided above. 
        If the balance is negative, be stern but helpful. 
        If savings are good, congratulate them.
        Use formatting like bullet points if needed.
        `;

        // API Call
        if (typeof GROQ_API_KEY === 'undefined' || GROQ_API_KEY.includes("YOUR_")) {
            throw new Error("Please configure your Groq API Key in js/config.js");
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                model: "llama-3.1-8b-instant"
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        removeTyping(typingId);

        if (data.choices && data.choices[0] && data.choices[0].message) {
            const aiResponse = data.choices[0].message.content;
            appendMessage(aiResponse, 'ai');
        } else {
            appendMessage("Unexpected response from AI.", 'ai');
        }

    } catch (error) {
        removeTyping(typingId);
        let msg = error.message;
        appendMessage(`System Error: ${msg}`, 'ai');
        console.error(error);
    }
}

// Event Listeners
if (aiSendBtn) {
    aiSendBtn.addEventListener('click', () => askAI());
}

if (aiInput) {
    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') askAI();
    });
}
