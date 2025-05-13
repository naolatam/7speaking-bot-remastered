// ==UserScript==
// @name         7Speaking Activity bot
// @namespace    https://github.com/naolatam/7speaking-bot-remastered
// @version      1.1.6
// @description  7Speaking is fucked up
// @author       Borred
// @match        https://user.7speaking.com/*
// @grant        none
// ==/UserScript==


/*
 *************************************
 ************ 7SPEAKING BOT ***********
 *************************************
 */
let title = "7Speaking LMS";

/*
 ******* CONFIGURATION *******
 */
// Set this to 0 for normal mode
let hiddenLevel = 0;

// Set this to the number of activity you want to complete. It will count activity already completed from the first topics to the last one.
// If you have do an activity in the last topic, it will not be detected until the bot completes all activity in all topics before
// -1 means no limit
let activityCountToComplete = 151;

// Set this to the number of good and wrong answers you want.
let goodOne = 8;
let falseOne = 2;

// Set this to the time the bot should do on a quiz for every 10 minutes duration announced by 7speaking
// Ex: for a quiz of 25 minutes, set this to 2 will do the quiz in 5 minutes
let quizDuration = 1;

let logging = true;

//
//
// END OF CONFIGURATION
//
//
//

let actualGood = 0;
let actualFalse = 0;
let failToGetQuestion = 0;
// This table is void. It's used to store response parse from URL.
let responseMapQuestion = {};

// This table is use to store the answer of quiz
let quizAnswerMap = {};

let requestCache = {};

let lastCompletedTopicsId = 0;
let completedActivities = [];

/*
 ******* FUNCTIONS *******
 */

// This function is very utils and very easy to understand...
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isPath = (regex) => regex.test(location.pathname);
const min = (a, b) => (a < b ? a : b);
const randomBool = () => Math.random() > 0.8;
const getSessionId = () => localStorage.getItem("sessionId");
function error(message) {
    log(message);
}
// This function is used to log text in the console depending on the hiddenLevel
function log(...text) {
    if (hiddenLevel <= 1) {
        console.log("[7Speaking Bot]", ...text);
    }
}

// This method replace the original addEventListener method to allow the code to block some events listeners from being added
// This is used to bypass the automation detection of 7speaking
function byPassAutomationDetection() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (this instanceof Element && this.classList.contains('question__form')) {
            console.warn(`Blocked addEventListener on element with .question__form:`, { type });
            return; // block
        }

        return originalAddEventListener.call(this, type, listener, options);
    };

}
byPassAutomationDetection()

// This function is used to make request to the server and cache the response
async function makeRequest(
    url,
    method = "GET",
    headers = {},
    body = null,
    logging = true,
    force = false
) {
    if (requestCache[url] && !force) {
        if (logging) log("Request already cached", url);
        return requestCache[url];
    }
    if (logging) log("Making request", url);

    let request = await fetch(url, {
        method: method,
        headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "application/x-www-form-urlencoded",
            ...headers,
        },
        body: body,
    }).catch((err) => {
        log("Error while fetching", err);
        return null;
    });
    if (request == null) {
        if (logging) log("Error while fetching");
        return null;
    }
    if (request.status != 200) {
        if (logging) log("Server refuse the request: ", request.status);
        return null;
    }
    if (logging) log("Request response file received");
    let res = await request.json().catch((err) => {
        log("Error while parsing response", err);
        return null;
    });
    requestCache[url] = res;
    return res;
}


// This function is used to wait for an element to load in the page
async function waitForQuerySelector(selector, logEnabled = true, timeout = 50) {
    if (logEnabled) {
        log(`Waiting for querySelector('${selector}')`);
    }

    return new Promise((resolve, reject) => {
        let current = 0;
        const e = document.querySelector(selector);

        if (e) {
            resolve(e);
        }
        const interval = setInterval(() => {
            const e = document.querySelector(selector);
            current++;
            if (current >= timeout) {
                clearInterval(interval);
                resolve("Timeout");
            }
            if (e) {
                clearInterval(interval);
                resolve(e);
            }
        }, 100);
    });
}
// This function give React component of the current question
function getReactElement(e) {
    for (const key in e) {
        if (key.startsWith("__reactInternalInstance$")) {
            return e[key];
        }
    }

    return null;
}
// This function is used to get the react container of the current question
async function getContainer(logEnabled = true) {
    const e = await waitForQuerySelector(".question_content", logEnabled);
    return getReactElement(e);
}
async function getUserStats() {
    let sessionId = getSessionId();
    if (sessionId == null) {
        if (logging) log("SessionId not found, break");
        return null;
    }
    let request = await makeRequest(
        `https://platform.7speaking.com/apiws/logs.cfc?` +
        `sessionId=${sessionId}` +
        `&LI=FRE&languagetaught=ENG` +
        `&method=getactivitylog` +
        `&reload=1`,
        "GET",
        {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        null,
        true,
        true
    );
    if (request == null) {
        if (logging) log("Error while fetching stats");
        return null;
    }
    if (logging) log("Stats response file received");

    return request.payload.elearninglog.totalCompleted;


}
// This function allow to detect when the question is changed
async function IsSameQuestion(questionId) {
    if (isEnded()) return false;
    let newQuestionId = (await getQuizQuestion())?.id || -1;
    return newQuestionId == questionId;
}

function isEnded() {
    let ended = document.querySelector(".result-container");
    if (ended) {
        return true;
    }
    return false;
}

/*
 *************************************
 ************ QUIZ FUNCTIONS *********
 *************************************
 */
// This function is used to get the id of current quiz
function getQuizId() {
    if (isPath(/^\/document\/[0-9]+/) || isPath(/^\/quiz/)) {
        let id = location.pathname.match(/\d+/)[0];
        return id;
    }
    return 0;
}
async function getTimeTosleepQuiz() {
    let payload = await getQuizAnswerFromURL();
    let numberOfQuestion = payload.totaltocomplete;
    let timeTotal = (payload.duration / 10) * quizDuration * 60;
    let timePerQuestion = timeTotal / (numberOfQuestion * 2);
    return timePerQuestion;
}
async function getQuizQuestionAnswer() {
    let question = await getQuizQuestion();
    if (question == null) {
        return null;
    }
    if (question.useranswer != null) {
        return { SKIP: true };
    }
    let answer = question?.answerOptions?.answer;
    for (let i = 0; i < answer.length; i++) {
        let idx = question?.answerOptions?.options?.findIndex(
            (a) => a.id == answer[i].id
        );
        answer[i].idx = idx + 1;
    }
    return {
        id: answer.map((i) => i.id),
        answer: answer.map((i) => i.value),
        index: answer.map((i) => i.idx),
    };
}
async function getQuizAnswerFromURL() {
    let id = getQuizId();
    if (id == 0) {
        if (logging) log("Error occured, no quiz Id found, break");
        await sleep(300);
        return null;
    }
    if (quizAnswerMap[id]) {
        if (logging) log("Quiz already found in cache", quizAnswerMap[id]);
        return quizAnswerMap[id];
    }
    let prom = new Promise(async (resolve, reject) => {
        let sessionId = localStorage.getItem("sessionId");
        if (sessionId == null) {
            if (logging) log("SessionId not found, break");
            resolve(false);
        }
        let request = new XMLHttpRequest();
        request.open(
            "GET",
            `https://platform.7speaking.com/apiws/quiz.cfc?` +
            `sessionId=${sessionId}` +
            `&LI=FRE&languagetaught=ENG` +
            `&method=getquiz` +
            `&typesource=news` +
            `&sourceid=${id}` +
            `&bs-faei=0`
        );
        request.setRequestHeader("Accept", "application/json, text/plain, */*");
        request.setRequestHeader(
            "Accept-Language",
            "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
        );
        request.setRequestHeader(
            "Content-Type",
            "application/x-www-form-urlencoded"
        );
        request.onreadystatechange = function () {
            if (request.readyState === 4 && request.status === 200) {
                if (request.status == 200) {
                    if (logging) log("Quiz response file received");
                    let json = JSON.parse(request.responseText).payload;
                    resolve(json);
                } else {
                    log("Server refuse the request");
                    resolve(null);
                }
                resolve("A");
            }
        };
        request.send();
    });

    let res = await prom;
    if (res == null) return null;
    quizAnswerMap[id] = res;
    if (res.iscomplete) {
        log("Quiz is already completed, skipping");
        await sleep(300);
        return null;
    }
    let questions = res.questions.data;
    for (let i = 0; i < questions.length; i++) {
        let question = questions[i];
        let answer = question.answerOptions.answer;
        console.log(question.question, ":", answer[0].value);
    }
    return res;
}

async function getQuizWrongAnswer() {
    let answer = await getQuizQuestionAnswer();
    if (answer == null) {
        return null;
    }
    if (answer.SKIP) {
        return answer;
    }
    let question = await getQuizQuestion();
    if (question.variant == "fill") {
        answer.answer[0] += answer.answer[0][answer.answer[0].length - 1]
    }
    if (question.variant == "choice") {
        if (answer.index[0] == 0) {
            answer.index[0] = 1;
        } else {
            answer.index[0] -= 1;
        }
    }
    return answer
}

async function getQuizQuestionTitle(timeout = 50) {
    let el = await waitForQuerySelector(".question__title", logging, timeout);
    return el.textContent;
}
async function getQuizQuestion() {
    const normalize = (str) => str.replaceAll("_", "").replaceAll("\\r", "").replaceAll("\\n").replaceAll(/\s+/g, '').trim()
    logging = false;
    let questions = await getQuizAnswerFromURL();
    let actualQuestion = await getQuizQuestionTitle(10);
    logging = true;
    if (actualQuestion == "Timeout") {
        return null;
    }
    if (questions == null) {
        return null;
    }
    questions = questions.questions.data;
    for (let i = 0; i < questions.length; i++) {
        let a = questions[i].question.replaceAll("_", "").replaceAll("\\r", "").replaceAll("\\n").trim()
        let b = actualQuestion.replaceAll("_", "").replaceAll("\\r", "").replaceAll("\\n").trim()
        
        if (
            normalize(a) == normalize(b)
        ) {
            let question = questions[i];
            return {
                id: question.id,
                title: question.question,
                variant: question.variant,
                step: question.step,
                useranswer: question.useranswer,
                answerOptions: question.answerOptions,
            };
        }
    }
    return null;
}
// This function is used to show response to the user depending on the hiddenLevel
async function respondQuiz(question, answer) {
    if (answer == null) {
        return false;
    }
    let element = null
    switch (question.variant) {
        case "fill":
            element = await waitForQuerySelector(".answer-container input", false)
            element = getReactElement(element.parentElement.parentElement.parentElement.parentElement)
            element.child.memoizedProps.setAnswer(answer.answer[0])

            answer = {
                step: question.step,
                variant: question.variant,
                questionid: question.id,
                useranswer: answer.answer[0],
            };
            await sleep(700)
            break;

        case "choice":
            answer.index[0] = answer.index[0] > 0 ? answer.index[0] - 1 : 0;
            element = await waitForQuerySelector(".answer-container button[value='" + (answer.index[0]) + "']", false)
            element.click()
            answer = {
                step: question.step,
                variant: question.variant,
                questionid: question.id,
                useranswer: answer.index[0],
                useranswerid: answer.id[0],
                og: answer,
            };
            await sleep(750)
            break;
    }
    const submitButton = document.querySelector(
        ".question__btns__container button"
    );

    if (!submitButton) {
        return error("Can't find answer");
    }
    submitButton.click();
    await sleep(800)
    return true;

}
async function nextResponse() {
    const submitButton = document.querySelector(
        ".question__btns__container button"
    );

    if (!submitButton) {
        return error("Can't find answer");
    }
    submitButton.click();
    await sleep(800);
}

async function completeQuiz() {
    log(`Completing quiz `);
    if (isEnded()) {
        log("Quiz already completed");
        await sleep(300);
        document.querySelector(".btns__container button[to='/home']").click();
        await sleep(800);
        return;
    }
    let question = await getQuizQuestion();

    let answer = await findAnswer();
    if (failToGetQuestion > 5) {

    }
    if (question == null) {
        log(
            "[ERR] Unable to found the question. Please don't touch the page",
            await getQuizAnswerFromURL()
        );
        failToGetQuestion++;
        return await sleep(200);
    }
    failToGetQuestion = 0;
    // If the answer was entered manually, this code automatically go on the next question and restart resolving
    if (answer == null || answer.SKIP) {
        log("Answer skip");
        const submitButton = document.querySelector(
            ".question__btns__container button"
        );

        if (!submitButton) {
            return error("Can't find answer");
        }
        submitButton.click();
        await sleep(1000);
        return;
    }
    // This code send the response to the server, go to the next question and wait for the next question
    let responseStatus = await respondQuiz(question, answer);
    if (responseStatus) {
        await nextResponse();
        log("Waiting for next question...");
        let timeSince = 0
        while (await IsSameQuestion(question.id)) {
            await sleep(50);
            timeSince += 50;
            if (timeSince > 10000) {
                log("Get stuck, reloading the page");
                window.location.reload();
                return;
            }
        }
        await sleep(300);
    }
    return;

    // This function is used to find the answer of the question with delay and random response
    async function findAnswer() {
        let answer = await getQuizQuestionAnswer();
        if (answer == null || answer.SKIP) {
            return answer;
        }
        if (!answer?.SKIP) {
            log("Answer found");
        }

        //Manipulate good and wrong answers number to be fully random but always respect the goodOne and falseOne values
        if (!answer?.SKIP) {
            if (actualFalse == falseOne && actualGood == goodOne) {
                actualFalse = 0;
                actualGood = 0;
            }
            if (actualFalse < falseOne) {
                if (randomBool()) {
                    let sleepTime = await getTimeTosleepQuiz();
                    log(
                        "Waiting and reply wrong with random values (",
                        sleepTime,
                        "s)"
                    );
                    await sleep(sleepTime * 1000);
                    actualFalse++;
                    return await getQuizWrongAnswer();
                }
            }
            if (actualGood == goodOne && actualFalse < falseOne) {
                let sleepTime = await getTimeTosleepQuiz();
                log(
                    "Waiting and reply wrong with random values (",
                    sleepTime,
                    "s)"
                );
                await sleep(sleepTime * 1000);
                actualFalse++;
                return await getQuizWrongAnswer();
            }
            actualGood++;
        }
        await sleep(300);
        let waitedTime = 0;
        let lastTime = await getTimeTosleepQuiz(answer);
        let question = await getQuizQuestion();
        log("You need to wait:", lastTime, "seconds");
        while (waitedTime < lastTime) {
            let tmp = await getQuizQuestion();
            if (tmp == null || tmp.id != question.id) {
                log("Question changed, reset");
                return null;
            }
            await sleep(1000);
            waitedTime += 1;
        }

        return await getQuizQuestionAnswer();
    }
}

async function getAllTopics() {
    let sessionId = getSessionId();
    if (sessionId == null) {
        if (logging) log("SessionId not found, break");
        return null;
    }
    let request = await makeRequest(
        `https://platform.7speaking.com/apiws/videobytopic.cfc?` +
        `sessionId=${sessionId}` +
        `&LI=FRE&languagetaught=ENG` +
        `&method=getlisttopic`,
        "GET",
        {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        null,
        true,
        false
    );
    if (request == null) {
        if (logging) log("Error while fetching topics");
        return null;
    }
    if (logging) log("Topics response file received");
    let res = [];
    request.payload.categories.forEach((i) => {
        res.push(...i.topics);
    });
    return res;
}

async function getAllTopicsActivity(topicsId) {
    let sessionId = getSessionId();
    if (sessionId == null) {
        if (logging) log("SessionId not found, reload");
        window.location.reload();
        return null;
    }
    let request = await makeRequest(
        `https://platform.7speaking.com/apiws/videobytopic.cfc?` +
        `sessionId=${sessionId}` +
        `&LI=FRE&languagetaught=ENG` +
        `&method=gettopicdetail` +
        `&topicid=${topicsId}`,
        "GET",
        {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        null,
        true,
        true
    );
    if (request == null) {
        if (logging)
            log("Error while fetching topics activities (id: ", topicsId, ")");
        return null;
    }
    if (logging)
        log("Topics activities response file received (id: ", topicsId, ")");
    let res = [];
    return request.payload.data;
}

async function getNextActivity() {
    let topics = await getAllTopics();
    if (topics == null) {
        log("Unable to fetch last topics. Topics was not load");
        return null;
    }
    let start = topics.findIndex((i) => i.id == lastCompletedTopicsId) + 1;

    for (let i = start; i < topics.length; i++) {
        let topic = topics[i];
        log("Waiting to avoid process overload and rate limit");
        await sleep(1000);

        log("Fetch the topic page to avoid bot detection");
        await fetch(
            "https://user.7speaking.com/video-by-theme/" + (i + 1)
        ).catch((err) => {
            log("Error while fetching topic page", err);
            return null;
        });
        await sleep(2000);

        let activities = await getAllTopicsActivity(topic.id);
        if (activities == null) {
            log("Unable to fetch last topics. Activities was not load");
            return null;
        }
        if (activities.length == 0) {
            log("No activity found for this topic");
            continue;
        }
        // Check for all the activities if they are already completed
        for (let i = 0; i < activities.length; i++) {
            // Add the activity to the completedActivities list if it is already completed and not already in the list
            console.log(
                "Activity",
                activities[i].id,
                "is completed: ",
                activities[i].countersProps.completion,
                " (",
                "is in list: ",
                completedActivities.includes(activities[i].id),
                ")"
            );
            if (activities[i].countersProps.completion == true) {
                if (!completedActivities.includes(activities[i].id)) {
                    completedActivities.push(activities[i].id);
                }
                // Wait 75ms for each activity check to avoid bot detection
                await sleep(75);
            } else {
                // Activity not completed, return it
                return activities[i];
            }
        }
        // If all the activities are completed, set the lastCompletedTopicsId to the current topic id
        // and continue to the next topic
        lastCompletedTopicsId = topic.id;
    }
}

async function startNextActivity() {
    let activity = await getNextActivity();
    if (activityCountToComplete == completedActivities.length) {
        log("All activities completed");
        log("Stopping bot");
        return false;
    }
    if (activity == null) {
        log("Unable to fetch next activity. Activity was not load");
        return null;
    }
    window.location.replace(
        `https://user.7speaking.com/document/${activity.id}?type=news`
    );
}
// This function is used to start the bot and navigate through the website automatically
async function start() {
    while (true) {
        //console.clear();

        if (getSessionId() == null) {
            log("Not logged in, wait 1s");
            await sleep(1000);
            continue;
        } let stats = await getUserStats().catch((err) => {
            log("Error while fetching stats", err);
            return null;
        }
        );
        if (stats == null) {
            log("Unable to fetch stats");
        }

        log("Completed activities %: ", (stats * 100 / activityCountToComplete).toFixed(2));
        log("Completed activities: ", stats);

        log(`Analysing current route`);

        if (isPath(/^\/workshop\/news-based-lessons\/video-by-topics/)) {
            log("Starting first incomplete activity");
            if (await startNextActivity() == false) {
                log("All activities completed");
                log("Stopping bot");
                break;
            };
        } else if (isPath(/^\/document\/\d+/)) {
            log(`Current route is /document`);

            log("Waiting for quiz to load");
            await sleep(2000);
            // Click on the start button
            const e = await waitForQuerySelector(".appBarTabs__testTab");
            e.click();

            log("Fetching response for this quiz");
            await getQuizAnswerFromURL();
            await sleep(200);
        } else if (isPath(/^\/quiz\/news/)) {
            log("Completing quiz response for this quiz");
            await completeQuiz();
            await sleep(200);
        } else if (isPath(/^\/home/)) {
            log(
                "Bad location. Redirecting to the news based lessons, go to ",
                "https://user.7speaking.com/workshop/news-based-lessons/video-by-topics"
            );
            window.location.replace(
                "https://user.7speaking.com/workshop/news-based-lessons/video-by-topics"
            );
            await sleep(4000);

        } else {
            if (isPath(/^\autologin\//)) {
                await sleep(100);
                continue;
            }

        }
    }
}

(function () {
    if (document.readyState === "complete") {
        log(
            "Before starting, we implement many timer before responding. This is just for simulating a real person reading text and listening to audio. We try to make the wait time the shorter and optimised as we can!\nThe time you need to wait will be printed in this section every time you will need to wait.\n\nDON'T TRY TO RELOAD THE PAGE! IT WILL JUST RESTART THE TIMER FROM 0! IF YOU RESPOND MANUALLY, PLEASE NOTICE THAT THE TIMER WILL NOT BE RESETED FOR CORRESPODING THE NEW QUESTION!"
        );
        start();
    } else {
        window.addEventListener("load", async () => {
            log(
                "Before starting, we implement many timer before responding. This is just for simulating a real person reading text and listening to audio. We try to make the wait time the shorter and optimised as we can!\nThe time you need to wait will be printed in this section every time you will need to wait.\n\nDON'T TRY TO RELOAD THE PAGE! IT WILL JUST RESTART THE TIMER FROM 0! IF YOU RESPOND MANUALLY, PLEASE NOTICE THAT THE TIMER WILL NOT BE RESETED FOR CORRESPODING THE NEW QUESTION!"
            );
            start();
        });
    }
})();
