# 7Speaking Bot Remastered

This is an English bot that allows you to perform 7Speaking exercises automatically, simulating a real user with appropriate waits and anti-bot detection mechanisms.

## Installation

To use this bot, you need to add the script to an extension called Tampermonkey.

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Add the desired script to Tampermonkey.

## Available Versions

### `oldv1.js`

- **Description**: This is the old bot version.
- **Status**: Contains ugly code and is detected by 7Speaking.
- **Usage**: Not recommended.

### `v2 stable`

- **Description**: This is the stable version of the bot.
- **Status**: Recommended for use.
- **Usage**: Preferred version for reliable performance.

### `v2 -dev`

- **Description**: This is the development version of the bot.
- **Status**: Contains the latest updates but may not work properly.
- **Usage**: Use with caution, as it may have unstable features.

### `Activity bot - v1 stable`
- **Description**: This script is a new one i just ended. It's use to do activity on 7speaking automatically. It will complete all answers from quiz and go back to home after, and start again.
- **Status**: This is the first version i do of this script. This one is 95% stable and usable. 
- **Usage**: Use with caution, it is 100% automatic, there is no mode to hide it. 

## Usage

1. Choose the version of the script you want to use.
2. Copy the script content.
3. Open Tampermonkey and create a new script.
4. Paste the copied script content into the new script.
5. Save and enable the script in Tampermonkey.

## V2 LOG:
The V2 add several things, like a new anti-bot bypass to be more undetectable. A rewrite from 0, so the code is more epurated and efficiency.
And the best in this V2, is the configuration option. The first line of the script is fully of variable that you can edit to make the script act in several ways.
Everythings is explained in the code as commentary.
The V2 officially support toefl except for hiddenmode 1 and 2. Trying it will make code crash

### Dev logs:
Quiz is now supported. It's only supporting Hiddenmode 1,2,3 and 4 (no automatic for now, mode 0).
HiddenMode 0 doesn't work and will maybe never work.

### Activity Logs:
Quiz is now supported and fully automatic. The script override `addEventListener` original method to allow full controls on eventListener.
Allowing to disable automation detection of 7speaking.

## Disclaimer

Use this bot at your own risk. The developers are not responsible for any consequences arising from the use of this bot.

###  discontinued
This project is no longer actively maintained. The bot is fully functional and automates 7Speaking tasks effectively. Updates will only be made if a pull request is submitted or if 7Speaking introduces changes that break the bot. The expected end-of-life (EOL) for this project is 2028.