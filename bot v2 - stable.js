// ==UserScript==
// @name         My 7Speaking Bot
// @namespace    https://github.com/
// @version      2.2
// @description  7Speaking is fucked up
// @author       Borred
// @match        https://user.7speaking.com/*
// @grant        none
// ==/UserScript==

/*
 ******* CONFIGURATION *******
 */
// Set this to 0 for normal mode
// Set this to 1 for no automatic response, the response is marked by a green background and logs are shown
// Set this to 2 for no automatic response and no logs, just a green background on rigth response
// Set this to 3 for no automatic response, no logs, no automatic navigation, hidden response in title/URL
// Set this to 4 for the same as 3 but with a no delay before showing the response
let hiddenLevel = 0;

// Set the place where you want to hide the response in hiddenLevel 3.
// You can choose one and set multiple between:
// - "TITLE" : This replace the 7 of 7Speaking in the title by the response
//     - Example: "7Speaking" => "BSpeaking" if the response is B
// - "URL" : This replace the 'id' in the URL by the response
//    - Example: "7speaking.com/workshop/exams-tests/myexam?id=1" => "7speaking.com/workshop/exams-tests/myexam?id=A" if the response is A

let hiddingPlace = ["TITLE", "URL"];

// Set this to the number of miliseconds you want the response to be shown
// Set to 0 to make it always visible.
let hideDuration = 2500;

// Set this to true to enable automatic navigation. This will automatically go to the next exercice
let autoNavigation = false;

// Set this to false if you want the bot to always respond good.
// If it's true, it will use the goodOne and falseOne values to make random mistakes.
let canBeWrong = true;

// This will define how much error the script will do!
let goodOne = 8;
let falseOne = 2;
let actualGood = 0;
let actualFalse = 0;

// This table contains all available exam modes
let availableExamModes = ["toeic", "toefl"];

// This table is use to convert response into a number of seconds to wait
let responseMap = {
  A: 1 / 4,
  B: 2 / 4,
  C: 3 / 4,
  D: 4 / 4,
};
// This table is use to convert response into a number
let responseMapNumber = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

// This table is use to convert number into response
let numberMapResponse = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
};

// This table is void. It's used to store response parse from URL.
let responseMapQuestion = {};

/*
 ******* FUNCTIONS *******
 */

// This function is very utils and very easy to understand...
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isPath = (regex) => regex.test(location.pathname);
const isThereAudio = () => document.querySelector("audio") !== null;
const min = (a, b) => (a < b ? a : b);
const randomBool = () => Math.random() > 0.8;

// This function is used to log text in the console depending on the hiddenLevel
function log(...text) {
  if (hiddenLevel <= 1) {
    console.log("[7Speaking Bot]", ...text);
  }
}
function getExamMode() {
  if (isPath(/^\/workshop\/exams-tests/)) {
    let search = new URLSearchParams(location.search);
    if (search.has("id")) {
      let mode = location.href.match(/[^/]+$/)[0].split("?")[0];
      if (mode == "myexam") {
        mode = "toeic";
      }
      return mode;
    }
  }
}

// This function is used to get the time we should wait as a real person to respond.
async function getTimeTosleep(answer) {
  if (hiddenLevel != 4) {
    if (isThereAudio()) {
      let audio = document.querySelector("audio");
      return audio.duration * responseMap[answer];
    } else {
      let desc = document.querySelector(".main_question_description");
      if (!desc) return 11.75; // The time needed to read 150 characters
      else desc = desc.textContent.length;
      return min(48 * desc, 11.75);
    }
  }
  return 0;
}
// This function is used to wait for an element to load in the page
async function waitForQuerySelector(selector, logEnabled = true) {
  if (logEnabled) {
    log(`Waiting for querySelector('${selector}')`);
  }

  return new Promise((resolve, reject) => {
    const e = document.querySelector(selector);

    if (e) {
      resolve(e);
    }
    const interval = setInterval(() => {
      const e = document.querySelector(selector);

      if (e) {
        clearInterval(interval);
        resolve(e);
      }
    }, 100);
  });
}
async function waitForQuestionTitle(titleE) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      let questionTitle = await waitForQuerySelector(".question_title", false);
      if (questionTitle) {
        if (questionTitle.textContent == titleE) {
          clearInterval(interval);
          resolve(true);
        }
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
// This function is used to return the id of test
function getTestId() {
  const search = new URLSearchParams(location.search);

  if (search.has("id")) {
    return search.get("id");
  } else {
    return 1;
  }
}
// This function is used to get the correct answer of the question without any delay and mistakes
async function getExamAnswer() {
  if ((await getExamQuestion()).type == "sampleResponse") {
    log(`This is not a question, so it doesn't need an answer. Skipping...`);
    return {"SKIP": true};
  }
  let container = await getContainer(false);
  let answer = null;
  while (container) {
    if (container.memoizedProps && container.memoizedProps.questions) {
      const [question] = container.memoizedProps.questions;
      //if question is already answered or is correct, return null
      if (
        question.userAnswers != null ||
        question.answer != null ||
        question.iscorrect == 1
      ) {
        return null;
      }
      // If question need order
      if (question.needorder) {
        const options = {};

        for (const k in question.answer) {
          options[k] = question.answer[k].sort((a, b) => a - b);
        }

        return options;
      }
      // If the answer is not directly in the question, get it from the error message
      if (question.answer == null) {
        try {
          answer = question.errorMessage.split("(")[1].slice(0, 1);
        } catch (error) {
          answer = await getExamAnswerFromURL();
        }
      } else {
        // If the answer is directly in the question, get it
        answer = question.answer;
      }
      if (answer != null) {
        return answer;
      }
    }
    container = container.return;
  }

  return null;
}
async function getExamAnswerFromURL() {
  if ((await getExamQuestion().type) == "sampleResponse") {
    log(`This is not a question, so it doesn't need an answer. Skipping...`);
    return {"SKIP": true};
  }
  return new Promise(async (resolve, reject) => {
    log(
      `Unable to fetch response from the react Element. Trying to fetch from the URL`
    );
    let mode = getExamMode();
    let sessionId = localStorage.getItem("sessionId");
    if (sessionId == null) {
      log("SessionId not found, break");
      resolve(false);
    }
    let questionPos = await getExamQuestionPosition();
    let question = await getExamQuestion();
    if (responseMapQuestion[question.id]) {
      log("Answer found in the cache", responseMapQuestion[question.id]);
      resolve(responseMapQuestion[question.id]);
    }
    let request = new XMLHttpRequest();
    request.open(
      "GET",
      `https://platform.7speaking.com/apiws/toefl.cfc?` +
        `testid=${getTestId()}` +
        `&partid=${questionPos.partIdx + 1}` +
        `&method=get${mode}test` +
        `&sessionId=${sessionId}` +
        `&languagetaught=ENG&LI=FRE`
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
        log("Response received");
        if (request.status == 200) {
          let json = JSON.parse(request.responseText);
          let response =
            json.payload.data[questionPos.sectionIdx].questions[
              questionPos.questionIdx
            ].answerOptions.answer;
          if (response.length == 1) {
            response = response[0].display.replace("(", "").replace(")", "");
          }
          log("Answer found", response);
          responseMapQuestion[question.id] = response;
          resolve(response);
        } else {
          log("Server refuse the request");
          resolve(null);
        }
        resolve("A");
      }
    };
    request.send();
  });
}
async function getExamWrongAnswer() {
  let question = await getExamQuestion();
  switch (question.type) {
    case "sampleResponse":
      return ""; // Nothing to answer
    case "radio":
      return "A";
    case "checkbox":
      return ["A"];
    case "array_lists":
      return [{ colNumber: 1, value: ["A"] }];
  }
  return "A"
}

// This function is used to get the question details of the current page (id, number, title)
async function getExamQuestion() {
  let container = await getContainer(false);
  while (container) {
    if (container.memoizedProps && container.memoizedProps.questions) {
      let [question] = container.memoizedProps.questions;
      return {
        id: question.id,
        title: question.title,
        number: question.title?.split("Question ")[1],
        type: question.type,
      };
    }
    container = container.return;
  }
  return null;
}
// This function is used to get the current question position in the exam (PartId, QuestionId, SectionId)
async function getExamQuestionPosition() {
  let container = await getContainer(false);
  while (container) {
    if (
      container.memoizedProps &&
      container.memoizedProps.currentQuestionPosition
    ) {
      let res = container.memoizedProps.currentQuestionPosition;
      // Adding some usefull functions to the object
      res.isIntro = () => {
        return res.sectionIdx == 0;
      };
      return res;
    }
    container = container.return;
  }
  return null;
}
// This function is used to know if the question has changed or not.
async function IsSameQuestion(questionPos, questionId) {
  let newQuestionPos = await getExamQuestionPosition();
  let newQuestionId = (await getExamQuestion())?.id || -1;
  if (
    newQuestionPos.questionIdx == questionPos.questionIdx &&
    newQuestionPos.sectionIdx == questionPos.sectionIdx &&
    newQuestionId == questionId
  ) {
    return true;
  }
  return false;
}
// This function use the function of 7Speaking to get the next question
async function nextResponse() {
  let container = await getContainer(false);
  while (container) {
    if (container.memoizedProps && container.memoizedProps.questions) {
      let { nextQuestion } = container.memoizedProps;
      nextQuestion();
      return;
    }
    container = container.return;
  }
  return null;
}
// This function is used to show response to the user depending on the hiddenLevel
async function respondExam(question, answer, mode) {
  if (answer == null) {
    return new Promise((resolve, reject) => {
      resolve(false);
    });
  }
  return new Promise(async (resolve, reject) => {
    switch (question.type) {
      case "sampleResponse":
        resolve(true); // Nothing to answer
      case "radio":
        if (getExamMode() == "toefl" && !isNaN(answer)) {
          answer = numberMapResponse[answer];
        }
        if (getExamMode() == "toeic" && isNaN(answer)) {
          answer = responseMapNumber[answer];
        }
        break;
      case "checkbox":
        answer = answer.join(",")
        break;
      case "array_lists":
        answer = answer
        break;
    }
    if (hiddenLevel == 0) {
      log(
        `Responding to question ${question.number} with answer ${answer} ` +
          `| ${responseMapNumber[answer]} in mode ${mode}`
      );
      let sessionId = localStorage.getItem("sessionId");
      if (sessionId == null) {
        log("SessionId not found, break");
        resolve(false);
      }
      let request = new XMLHttpRequest();
      request.open(
        "POST",
        `https://platform.7speaking.com/apiws/${mode}.cfc?method=post${mode}quiz` +
          "&sessionId=" +
          sessionId +
          "&languagetaught=ENG&LI=FRE"
      );
      request.setRequestHeader("Accept", "application/json, text/plain, */*");
      request.setRequestHeader(
        "Content-Type",
        "application/x-www-form-urlencoded"
      );
      request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
          log("Response received");
          if (request.status == 200) {
            let json = JSON.parse(request.responseText);
            log(
              "Answer was correct: ",
              json.payload.data[0].iscorrect ? "✅" : "❌",
              "Correct answer: ",
              json.payload.data[0].correctanswers
            );
          } else {
            log("Server refuse the response");
            resolve(false);
          }
          resolve(true);
        }
      };
      let userAnswers = [
        {
          questionid: question.id,
          useranswer: answer,
        }
      ];

      log("Sending response", userAnswers);
      request.send(
        `testid=${getTestId()}&useranswers=${JSON.stringify(userAnswers)}`
      );
    } else if (hiddenLevel == 1 || hiddenLevel == 2) {
      log(
        `Responding to question ${question.number} with answer ${answer} ` +
          `| ${responseMapNumber[answer]} in mode ${mode}`
      );
      const inputs = document.querySelectorAll(".question_variant label");

      if (isNaN(answer)) {
        const options = answer.split(",");

        for (const option of options) {
          inputs[
            option.charCodeAt(0) - "A".charCodeAt(0)
          ].style.backgroundColor = "green";
        }
      } else {
        inputs[+answer - 1].style.backgroundColor = "green";
      }
      // Just to avoid infinite iteration that can freeze the page
      await sleep(300);
      resolve(true);
    } else if (hiddenLevel == 3 || hiddenLevel == 4) {
      if(question.type == "array_lists") {
        let tmp = ""
        for (let i = 0; i < answer.length; i++) {
          tmp += answer[i].colnumber + "-" + answer[i].value.join(",") + "/"
        }
        answer = tmp
      }
      if (hiddingPlace.includes("TITLE")) {
        document.title = answer + "Speaking LMS";
      }
      if (hiddingPlace.includes("URL")) {
        location.hash = answer;
      }
      if (hideDuration > 0) {
        let waitedTime = 0;
        let question = await getExamQuestion();
        let questionPos = await getExamQuestionPosition();
        log("You need to wait:", hideDuration/1000, "seconds");
        while (waitedTime < hideDuration / 1000) {
          if (!(await IsSameQuestion(questionPos, question.id))) {
            questionPos = await getExamQuestionPosition();
            question = await getExamQuestion();
            // If the new question is an Intro, return.
            if (questionPos.isIntro()) {
              resolve(true);
            }
            answer = await getExamAnswer();

            if (hiddingPlace.includes("TITLE")) {
              document.title = answer + "Speaking LMS";
            }
            if (hiddingPlace.includes("URL")) {
              location.hash = answer;
            }
          }
          await sleep(hideDuration / 10);
          waitedTime += hideDuration / 1000 / 10;
        }
        document.title = document.title.replace(answer, "7");
        location.hash = "";
        resolve(true);
      } else {
        if (hiddingPlace.includes("TITLE")) {
          document.title = answer + "Speaking LMS";
        }
        if (hiddingPlace.includes("URL")) {
          location.hash = answer;
        }
      }
      resolve(true);
    }
  });
}

async function completeExam(mode) {
  log(`Completing exam ${mode}`);
  if (availableExamModes.indexOf(mode) == -1) {
    log(`Mode ${mode} not supported`);
    throw new Error();
  }
  // Check if the question is an introduction to one of the  part of toeic
  let questionPosition = await getExamQuestionPosition();

  if (questionPosition.isIntro()) {
    const submitButton = document.querySelector(
      ".buttons_container button:last-child"
    );

    if (!submitButton) {
      return log("Can't find answer");
    }
    // skip the introduction page
    submitButton.click();
    while (await IsSameQuestion(questionPosition, -1)) {
      await sleep(50);
    }
    await sleep(200);
    questionPosition = await getExamQuestionPosition();
  }
  // end

  // start completing exam, and adding some delay to simulate a real person
  let answer = await findAnswer();
  let question = await getExamQuestion();
  // reset response hiding place
  if (hiddenLevel == 3) {
    document.title =document.title.replace(answer, "7");
    location.hash = "";
  }

  if (question == null) {
    log(
      "[ERR] Unable to found the question. Please don't touch the page",
      await getContainer()
    );
    return await sleep(200);
  }
  // If the answer was entered manually, this code automatically go on the next question and restart resolving
  if (answer == null) {
    if (hiddenLevel == 0) {
      const submitButton = document.querySelector(
        ".buttons_container button:last-child"
      );

      if (!submitButton) {
        return error("Can't find answer");
      }
      submitButton.click();
    } else {
      log("No answer found, skipping");
    }
    await sleep(1000);
    return;
  }
  // This code send the response to the server, go to the next question and wait for the next question
  let responseStatus = await respondExam(question, answer, mode);
  if (responseStatus) {
    if (hiddenLevel == 0) {
      await nextResponse();
      log("Waiting for next question...");
      while (await IsSameQuestion(questionPosition, question.id)) {
        await sleep(50);
      }
    }

    await sleep(300);
  }
  return;

  // This function is used to find the answer of the question with delay and random response
  async function findAnswer() {
    let answer = await getExamAnswer();
    if(!answer?.SKIP) {
      log("Answer found", answer);      
    }
    if (answer == null) {
      return null;
    }

    // Manipulate good and wrong answers number to be fully random but always respect the goodOne and falseOne values
    if (canBeWrong && !answer?.SKIP) {
      if (actualFalse == falseOne && actualGood == goodOne) {
        actualFalse = 0;
        actualGood = 0;
      }
      if (actualFalse < falseOne) {
        if (randomBool()) {
          log("Waiting and reply wrong with A (3s)");
          await sleep(3000);
          actualFalse++;
          return await getExamWrongAnswer();
        }
      }
      if (actualGood == goodOne && actualFalse < falseOne) {
        log("Waiting and reply wrong with A (3s)");
        actualFalse++;
        return await getExamWrongAnswer();
      }
      actualGood++;
    }
    await sleep(300);
    let waitedTime = 0;
    let lastTime = await getTimeTosleep(answer);
    let question = await getExamQuestion();
    let questionPos = await getExamQuestionPosition();
    log("You need to wait:", lastTime, "seconds");
    while (waitedTime < lastTime) {
      if (!(await IsSameQuestion(questionPos, question.id))) {
        log("Question changed, restarting timer");
        questionPos = await getExamQuestionPosition();
        // If the new question is an Intro, return.
        if (questionPos.isIntro()) {
          return null;
        }
        await sleep(300);

        // Reset everythings.
        waitedTime = 0.3;
        answer = await getExamAnswer();
        lastTime = await getTimeTosleep(answer);
        question = await getExamQuestion();
        log("You need to wait:", lastTime, "seconds");
      }
      await sleep(1000);
      waitedTime += 1;
    }

    return await getExamAnswer();
  }
}

// This function is used to start the bot and navigate through the website automatically
async function start() {
  while (true) {
    log(`Analysing current route`);

    if (isPath(/^\/home/) && hiddenLevel == 0 && autoNavigation) {
      log(`Current route is /home`);

      log(`Selecting the first content...`);

      const e = await waitForQuerySelector(
        ".scrollableList .scrollableList__content .MuiButtonBase-root"
      );
      e.click();
    } else if (isPath(/^\/workshop\/exams-tests/)) {
      const search = new URLSearchParams(location.search);

      if (search.has("id")) {
        let mode = location.href.match(/[^/]+$/)[0].split("?")[0];
        if (mode == "myexam") {
          mode = "toeic";
        }
        await completeExam(mode);
      } else {
        if (hiddenLevel == 0 && autoNavigation) {
          const nextExam = await waitForQuerySelector(
            ".lists .list__items.active"
          );
          nextExam.click();

          await sleep(300);

          const modalConfirmButton = document.querySelector(
            ".confirmCloseDialog__buttons button:last-child"
          );

          if (modalConfirmButton) {
            modalConfirmButton.click();
          }
        }
        await sleep(1000);
      }
    } else if (isPath(/^\/workshop/) && hiddenLevel == 0 && autoNavigation) {
      log(`Current route is /workshop`);

      await waitForQuerySelector(".banner");

      const buttons = document.querySelectorAll(
        ".bottom-pagination .pagination button"
      );

      if (buttons.length > 0) {
        buttons[buttons.length - 1].click();
      }

      let quizButton = document.querySelector(".category-action-bottom button");

      if (!quizButton) {
        quizButton = document.querySelector(
          "button.cardMode__goToQuiz:not(.finalCard__btns button)"
        );
      }

      if (!quizButton) {
        log("Can't find quiz button, returning to /home");
        location.href = "/home";
        throw new Error();
      }

      quizButton.click();
    } else if (
      isPath(/^\/document\/\d+/) &&
      hiddenLevel == 0 &&
      autoNavigation
    ) {
      log(`Current route is /document`);

      const e = await waitForQuerySelector(".appBarTabs__testTab");
      e.click();
    } /*  else if (isPath(/^\/quiz/)) {
      log(`Current route is /quiz`);

      await waitForQuerySelector(".quiz__container");

      if (document.querySelector(".result-container")) {
        location.href = "/home";
      } else {
        if (hiddenLevel == 0) {
          await completeQuiz();
        }
      }
    } */ else {
      await sleep(1000);
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
