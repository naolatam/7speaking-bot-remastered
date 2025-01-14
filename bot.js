// ==UserScript==
// @name         My 7Speaking Bot
// @namespace    https://github.com/naolatam
// @version      1.0
// @description  7Speaking is kil
// @author       Devex
// @match        https://user.7speaking.com/*
// @grant        none
// ==/UserScript==
let SevenSpeakingBotRunning = true;
(async () => {
  let goodOne = 0;
  let falseOne = 0;
  let hiden = 0;

  function log(message) {
    if (hiden ==0 ) {
      console.log(`[7Speaking Bot] ${message}`);
    }
  }

  function updateTitle(newTitle) {
    let title = document.querySelector("title");
    title.innerHTML = newTitle;
  }
  async function start() {
    while (SevenSpeakingBotRunning) {
      log(`Analysing current route`);

      if (isPath(/^\/home/) && hiden == 0) {
        log(`Current route is /home`);

        log(`Selecting the first content...`);

        const e = await waitForQuerySelector(
          ".scrollableList .scrollableList__content .MuiButtonBase-root"
        );
        e.click();
      } else if (isPath(/^\/workshop\/exams-tests/)) {
        const search = new URLSearchParams(location.search);

        if (search.has("id")) {
          let mode = location.href.match(/[^/]+$/)[0];
          
          await completeExam(mode);
        } else {
          if(hiden == 0) {
            const nextExam = await waitForQuerySelector(
              ".lists .list__items.active"
            );
            nextExam.click();

            await wait(300);

            const modalConfirmButton = document.querySelector(
              ".confirmCloseDialog__buttons button:last-child"
            );

            if (modalConfirmButton) {
              modalConfirmButton.click();
            }

            await wait(1000);
          }else {
            await wait(1000)
          }
        }
      } else if (isPath(/^\/workshop/) && hiden == 0) {
        log(`Current route is /workshop`);

        await waitForQuerySelector(".banner");

        const buttons = document.querySelectorAll(
          ".bottom-pagination .pagination button"
        );

        if (buttons.length > 0) {
          buttons[buttons.length - 1].click();
        }

        let quizButton = document.querySelector(
          ".category-action-bottom button"
        );

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
      } else if (isPath(/^\/document\/\d+/) && hiden == 0) {
        log(`Current route is /document`);

        const e = await waitForQuerySelector(".appBarTabs__testTab");
        e.click();
      } else if (isPath(/^\/quiz/)) {
        log(`Current route is /quiz`);

        await waitForQuerySelector(".quiz__container");

        if (document.querySelector(".result-container")) {
          location.href = "/home";
        } else {
          await completeQuiz();
        }
      } else {
        await wait(1000);
      }
    }
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const responseMap = {
    A: 4,
    B: 3,
    C: 2,
    D: 1,
  };
  function convertTimerToSeconds(timer) {
    const [minutes, seconds] = timer.split(":").map(Number); // Séparer les minutes et secondes
    return minutes * 60 + seconds; // Convertir tout en secondes
  }
  function min(a, b) {
    if (a > b) return b;
    else return a;
  }

  // Fonction pour convertir les secondes en format mm:ss
  function convertSecondsToTimer(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(0);
    // Format pour que les secondes et minutes soient toujours sur deux chiffres
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }

  // Fonction principale
  function updateTimer(additionalSeconds) {
    // Sélectionner l'élément <h3> qui contient le timer
    var timerElement = document.querySelector(
      ".ExamsAndTests__header__timepProgressContainer h3.timer"
    );

    // Vérifier si l'élément existe
    if (timerElement) {
      // Récupérer le timer actuel sous forme de texte (par exemple, "12:11")
      var currentTimer = timerElement.textContent;

      // Convertir le timer en secondes
      var currentSeconds = convertTimerToSeconds(currentTimer);

      // Ajouter un nombre de secondes spécifique (par exemple, 90 secondes)
      var newSeconds = currentSeconds + additionalSeconds;

      // Convertir le nouveau temps total en format mm:ss
      var newTimer = convertSecondsToTimer(newSeconds);

      // Afficher le nouveau timer dans la console
      return newTimer;
    } else {
      return "Timer not found";
    }
  }

  function isPath(regex) {
    return regex.test(location.pathname);
  }

  function error(message) {
    alert(message);
    throw new Error(message);
  }

  async function waitForQuerySelector(selector, logEnabled = true) {
    if (logEnabled) {
      log(`Waiting for querySelector('${selector}')`);
    }

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const e = document.querySelector(selector);

        if (e) {
          clearInterval(interval);
          resolve(e);
        }
      }, 100);
    });
  }

  function getReactElement(e) {
    for (const key in e) {
      if (key.startsWith("__reactInternalInstance$")) {
        return e[key];
      }
    }

    return null;
  }

  async function completeQuiz() {
    async function findAnswer() {
      const e = await waitForQuerySelector(".question-container");
      let container = getReactElement(e);

      while (container) {
        if (container.memoizedProps) {
          return container.memoizedProps.children[5].props.children[0].props
            .children.props.answerOptions.answer[0].value;
        }

        container = container.return;
      }

      return null;
    }

    function getInputElement(answer) {
      const e = document.querySelector(".question__form input");

      if (e) {
        return {
          element: getReactElement(e),
          type: "input",
        };
      }

      const buttons = document.querySelectorAll(".answer-container button");

      for (const button of buttons) {
        if (
          button.querySelector(".question__customLabel").innerText.trim() ===
          answer.trim()
        ) {
          return {
            element: button,
            type: "button",
          };
        }
      }

      return null;
    }

    function getSubmitButton() {
      const e = document.querySelector(".question__form button[type=submit]");
      return e;
    }

    log("Searching for the answer...");

    const answer = await findAnswer();

    if (answer === null || answer === undefined) {
      return error("Can't find answer");
    }

    log(`Answer is "${answer}"`);

    const input = getInputElement(answer);

    if (!input) {
      return error("Can't find input");
    }

    log(`Question type is "${input.type}"`);

    if (input.type === "input") {
      if (hiden == 0) {
        input.element.memoizedProps.onChange({
          currentTarget: {
            value: answer,
          },
        });
      }
    } else if (input.type === "button") {
      if (hiden == 0) {
        input.element.click();
      }
    }

    await wait(200);

    const button = getSubmitButton();

    if (!button) {
      return error("Can't find submit button");
    }

    if (hiden == 0) {
      log(`Clicking "Validate" button`);

      button.click();

      await wait(500);

      log(`Clicking "Next" button`);

      button.click();

      await wait(500);
    }
  }

  async function completeExam(mode) {
    updateTitle("7Speaking LMS");
    const answer = await findAnswer(mode, 8, 2);
    log("Answer is: " + answer);
    if (hiden == 0) {
      if (answer === null || answer === undefined) {
        const submitButton = document.querySelector(
          ".buttons_container button:last-child"
        );

        if (!submitButton) {
          return error("Can't find answer");
        }
        submitButton.click();
        await wait(1000);
      } else {
        if (typeof answer === "object") {
          const optionsAreTypeof = (type) =>
            Object.values(answer).every((options) =>
              options.every((option) => typeof option === type)
            );

          if (optionsAreTypeof("boolean")) {
            log(`Options are booleans`);

            const lines = [
              ...document.querySelectorAll(".question_variant tbody tr"),
            ];

            for (const i in lines) {
              const inputs = lines[i].querySelectorAll("td input");

              for (const j in answer) {
                const input = inputs[+j - 1];

                if (answer[j][i]) {
                  if (mode == "myexam") {
                    input.click();
                  } else {
                    input.style.backgroundColor = "green";
                  }
                }
              }
            }
          } else if (optionsAreTypeof("string") || optionsAreTypeof("number")) {
            log(`Options are strings/numbers`);

            const columns = [
              ...document.querySelectorAll(".question_variant tbody tr td"),
            ];

            for (const i in answer) {
              const inputs = columns[+i - 1].querySelectorAll("input");

              for (const j in answer[i]) {
                const input = getReactElement(inputs[j]);

                input.memoizedProps.onChange({
                  target: {
                    value: answer[i][j].toString(),
                  },
                });
              }
            }
          } else {
            return error(`Can't understand this type of options`);
          }

          await wait(1000);
        } else {
          const inputs = document.querySelectorAll(".question_variant label");

          if (isNaN(answer)) {
            const options = answer.split(",");

            for (const option of options) {
              if (mode == "myexam") {
                inputs[option.charCodeAt(0) - "A".charCodeAt(0)].click();
              } else {
                inputs[
                  option.charCodeAt(0) - "A".charCodeAt(0)
                ].style.backgroundColor = "green";
              }
            }
          } else {
            if (mode == "myexam") {
              inputs[+answer - 1].click();
            } else {
              inputs[+answer - 1].style.backgroundColor = "green";
            }
          }
        }

        const submitButton = await waitForQuerySelector(
          ".buttons_container button:last-child"
        );

        submitButton.click();
        await wait(1000);

        submitButton.click();
        await wait(1000);
      }
    } else if (hiden > 0) {
      if (answer === null || answer === undefined) {
        const submitButton = document.querySelector(
          ".buttons_container button:last-child"
        );

        if (!submitButton) {
          return updateTitle("Can't find answer");
        }
      } else {
        if (typeof answer === "object") {
          const optionsAreTypeof = (type) =>
            Object.values(answer).every((options) =>
              options.every((option) => typeof option === type)
            );

          if (optionsAreTypeof("boolean")) {
          } else if (optionsAreTypeof("string") || optionsAreTypeof("number")) {
          } else {
            return error(`Can't understand this type of options`);
          }
        }
      }
    }
  }
  function isThereAudio() {
    return document.querySelector("audio") !== null;
  }
  function getAudioLength() {
    if (isThereAudio()) {
      const audio = document.querySelector("audio");
      return audio.duration;
    }
  }
  async function getTimeToWait(mode) {
    if (isThereAudio()) {
      let audioDuration = getAudioLength();
      let answer = await findAnswer(mode, 8, 2, false);
      return audioDuration / responseMap[answer];
    }
  }
  async function findAnswer(mode, Ngood, Nfalse, waiting = true) {
    if (hiden == 0) {
      if (mode == "myexam") {
        if (goodOne == Ngood) {
          if (falseOne < Nfalse) {
            const submitButton = document.querySelector(".question_variant");
            if (!submitButton || submitButton.children.length == 0) {
              return null;
            }
            log("Waiting 4s and reply wrong");
            await wait(4000);

            falseOne += 1;
            return "A";
          } else {
            goodOne = 1;
            falseOne = 0;
          }
        } else {
          goodOne += 1;
        }
      }
      const e = await waitForQuerySelector(".question_content");
      const audio = document.querySelector("audio");
      let container = getReactElement(e);
      let answer = null;
      while (container) {
        log(container);
        if (container.memoizedProps && container.memoizedProps.questions) {
          const [question] = container.memoizedProps.questions;

          if (question.needorder) {
            const options = {};

            for (const k in question.answer) {
              options[k] = question.answer[k].sort((a, b) => a - b);
            }

            return options;
          }
          if (question.answer == null) {
            answer = question.errorMessage.split("(")[1].slice(0, 1);
          } else {
            answer = question.answer;
          }
          log(`Answer is ${answer}`);
        }
        if (answer != null) {
          if (audio) {
            log(
              "This is an Audio question. Waiting for the audio to be listened entirely, this will take: " +
                audio.duration +
                "s\nThe question will be answered when the timer reach:",
              updateTimer(audio.duration)
            );
            if (mode == "myexam") {
              await wait((audio.duration / responseMap[answer]) * 1000);
            } else {
              log(
                "But because you're not in toeic, no wait time will be implemented"
              );
            }
          } else {
            let desc = document.querySelector(".main_question_description");
            if (!desc) desc = 150;
            else desc = desc.textContent.length;
            log("You need to wait:", min((100 * desc) / 1000, 10), "seconds");
            if (mode == "myexam") {
              await wait(min(100 * desc, 50 * 1000));
            } else {
              log(
                "But because you're not in toeic, no wait time will be implemented"
              );
            }
          }
          return answer;
        }
        container = container.return;
      }

      return null;
    } else {
      const e = await waitForQuerySelector(".question_content", waiting);
      const audio = document.querySelector("audio");
      let container = getReactElement(e);
      let answer = null;
      while (container) {
        if (container.memoizedProps && container.memoizedProps.questions) {
          const [question] = container.memoizedProps.questions;

          if (question.needorder) {
            const options = {};

            for (const k in question.answer) {
              options[k] = question.answer[k].sort((a, b) => a - b);
            }

            return options;
          }
          if (question.answer == null) {
            answer = question.errorMessage.split("(")[1].slice(0, 1);
          } else {
            answer = question.answer;
          }
        }
        if (answer != null && waiting == false) {
          return answer;
        }
        if (answer != null) {
          if (audio) {
            log(
              "This is an Audio question. Waiting for the audio to be listened entirely, this will take: " +
                audio.duration +
                "s\nThe question will be answered when the timer reach:",
              updateTimer(audio.duration)
            );
            let waitedTime = 0;
            let lastTime = await getTimeToWait(mode);
            let lastAnswer = answer;
            while (waitedTime < ((await getTimeToWait(mode)) || 0)) {
              if (isThereAudio()) {
                let time = Date.now();
                if ((await getTimeToWait(mode)) != lastTime || lastAnswer != await findAnswer(mode, Ngood, Nfalse, false)) {

                  if (isThereAudio()) {
                    lastTime = (await getTimeToWait(mode)) || 0;
                    lastAnswer = await findAnswer(mode, Ngood, Nfalse, false);
                    waitedTime = 0;
                  }else {
                    let desc = document.querySelector(".main_question_description");
                    if (!desc) desc = 150;
                    else desc = desc.textContent.length;
                    await wait(min(100 * desc, 50 * 1000));
                  }
                }
                let delayTime = (Date.now() - time);
                if (delayTime < 1000) {
                  await wait(1000 - delayTime);
                  waitedTime += 1;
                }else {
                  waitedTime += delayTime / 1000;
                }
                log("Check take time: " + (Date.now() - time) + "ms");
                log(
                  "You need to wait:" +
                    (((await getTimeToWait(mode)) || 0) - waitedTime) +
                    "seconds"
                );
              } else {
                break;
              }
            }
          } else {
            let desc = document.querySelector(".main_question_description");
            if (!desc) desc = 150;
            else desc = desc.textContent.length;
            await wait(min(100 * desc, 50 * 1000));
          }
          updateTitle(
            `${await findAnswer(mode, Ngood, Nfalse, false)}Speaking LMS`
          );
          if (hiden == 2) {
            await wait(2500);
            updateTitle("7Speaking LMS");
          }
          return await findAnswer(mode, Ngood, Nfalse, false);
        }
        container = container.return;
      }

      return null;
    }
  }

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
