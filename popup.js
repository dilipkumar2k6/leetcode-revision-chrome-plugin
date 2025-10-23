document.addEventListener('DOMContentLoaded', () => {
    const timerDisplay = document.getElementById('timer');
    const problem1El = document.getElementById('problem1');
    const problem2El = document.getElementById('problem2');
    const nextBtn = document.getElementById('next-btn');
    const resetBtn = document.getElementById('reset-btn');
    const loadingContainer = document.getElementById('loading-container');
    const loginMessage = document.getElementById('login-message');
    const problemsContainer = document.getElementById('problems-container');
    const lastProblemsInput = document.getElementById('last-problems-input');

    let timerInterval;

    function updateTimer(endTime) {
        clearInterval(timerInterval);
        if (!endTime) {
            timerDisplay.textContent = '30:00';
            return;
        }

        timerInterval = setInterval(() => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                timerDisplay.textContent = '00:00';
                clearInterval(timerInterval);
                return;
            }
            const minutes = Math.floor((remaining / 1000) / 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }, 1000);
    }

    function updatePopupUI(data) {
        loadingContainer.style.display = 'none';

        if (data.error || (data.currentProblems && data.currentProblems.length === 0)) {
            loginMessage.style.display = 'block';
            problemsContainer.style.display = 'none';
        } else {
            loginMessage.style.display = 'none';
            problemsContainer.style.display = 'block';

            const [problem1, problem2] = data.currentProblems;
            problem1El.innerHTML = `<a href="https://leetcode.com/problems/${problem1.titleSlug}" target="_blank">${problem1.title}</a>`;
            problem2El.innerHTML = `<a href="https://leetcode.com/problems/${problem2.titleSlug}" target="_blank">${problem2.title}</a>`;
        }
        updateTimer(data.timerEndTime);
    }

    // Initial UI update on popup open
    chrome.storage.local.get(['currentProblems', 'timerEndTime', 'error', 'lastProblemsCount'], (data) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        if (data.currentProblems) {
            updatePopupUI(data);
        } else {
            loadingContainer.style.display = 'block';
        }
        lastProblemsInput.value = data.lastProblemsCount || 100;
    });

    // Listen for storage changes to update UI in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            chrome.storage.local.get(['currentProblems', 'timerEndTime', 'error'], (data) => {
                updatePopupUI(data);
            });
        }
    });

    lastProblemsInput.addEventListener('change', () => {
        const value = parseInt(lastProblemsInput.value, 10);
        if (!isNaN(value) && value >= 2) {
            chrome.storage.local.set({ lastProblemsCount: value });
        }
    });

    nextBtn.addEventListener('click', () => {
        loadingContainer.style.display = 'block';
        chrome.runtime.sendMessage({ action: 'getNextProblems' });
    });

    resetBtn.addEventListener('click', () => {
        loadingContainer.style.display = 'block';
        chrome.runtime.sendMessage({ action: 'reset' });
    });
});
