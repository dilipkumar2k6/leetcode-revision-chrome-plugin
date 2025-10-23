const LEETCODE_GQL_URL = 'https://leetcode.com/graphql';
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

const GRAPHQL_QUERY = {
  query: `
    query userProgressQuestionList($filters: UserProgressQuestionListInput) {
      userProgressQuestionList(filters: $filters) {
        questions {
          title
          titleSlug
          frontendId
          questionStatus
        }
      }
    }
  `,
  variables: { filters: { skip: 0, limit: -1 } },
  operationName: 'userProgressQuestionList'
};

async function fetchLeetCodeApi() {
    const getCookie = (name) => new Promise(resolve => {
        chrome.cookies.get({ url: LEETCODE_GQL_URL, name }, cookie => resolve(cookie ? cookie.value : null));
    });

    const csrfToken = await getCookie('csrftoken');
    const session = await getCookie('LEETCODE_SESSION');

    if (!csrfToken || !session) {
        return { error: 'Not authenticated' };
    }

    try {
        const response = await fetch(LEETCODE_GQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrftoken': csrfToken,
                'cookie': `csrftoken=${csrfToken}; LEETCODE_SESSION=${session}`
            },
            body: JSON.stringify(GRAPHQL_QUERY)
        });
        return await response.json();
    } catch (error) {
        return { error: 'Network error' };
    }
}

async function getAndSetNextProblems() {
    const { lastProblemsCount = 100 } = await new Promise(resolve => {
        chrome.storage.local.get('lastProblemsCount', data => resolve(data || {}));
    });

    const data = await fetchLeetCodeApi();

    if (data.error || !data.data || !data.data.userProgressQuestionList) {
        chrome.storage.local.set({ currentProblems: [], timerEndTime: null });
        return;
    }

    const allProblems = data.data.userProgressQuestionList.questions;
    let solvedProblems = allProblems.filter(p => p.questionStatus === 'SOLVED');

    if (solvedProblems.length > lastProblemsCount) {
        solvedProblems = solvedProblems.slice(solvedProblems.length - lastProblemsCount);
    }

    if (solvedProblems.length < 2) {
        chrome.storage.local.set({ currentProblems: [], timerEndTime: null, error: 'Not enough solved problems.' });
        return;
    }

    let { presentedProblems = [] } = await new Promise(resolve => {
        chrome.storage.local.get('presentedProblems', data => resolve(data || {}));
    });
    let availableProblems = solvedProblems.filter(p => !presentedProblems.includes(p.frontendId));

    if (availableProblems.length < 2) {
        presentedProblems = [];
        availableProblems = solvedProblems;
    }

    const problem1 = availableProblems[Math.floor(Math.random() * availableProblems.length)];
    let problem2;
    do {
        problem2 = availableProblems[Math.floor(Math.random() * availableProblems.length)];
    } while (problem1.frontendId === problem2.frontendId);

    const newPresented = [...presentedProblems, problem1.frontendId, problem2.frontendId];
    const timerEndTime = Date.now() + THIRTY_MINUTES_MS;

    chrome.storage.local.set({
        currentProblems: [problem1, problem2],
        presentedProblems: newPresented,
        timerEndTime
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['presentedProblems', 'currentProblems'], (data) => {
        if (!data.currentProblems) {
            getAndSetNextProblems();
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getNextProblems') {
        getAndSetNextProblems();
    }
    if (request.action === 'reset') {
        chrome.storage.local.set({ presentedProblems: [] }, () => {
            getAndSetNextProblems();
        });
    }
});