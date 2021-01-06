const _ = require("underscore");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
var brooklyn_99_quotes = [
  "I'm the human form of the 💯 emoji.",
  "Bingpot${prefix}",
  "Cool. Cool cool cool cool cool cool cool, no doubt no doubt no doubt no doubt.",
  "Sarge, with all due respect, I am gonna completely ignore everything you just said.",
  "The English language can not fully capture the depth and complexity of my thoughts, so I’m incorporating emojis into my speech to better express myself. Winky face.",
  "If I die, turn my tweets into a book.",
  "An Emoji Is Worth a 1000 Words",
];
module.exports = {
  name: "99",
  description: "Gives a random quote from Brooklyn Nine-Nine${prefix}",
  args: false,
  usage: `${prefix}99`,
  example: `${prefix}99`,
  guildOnly: true,
  execute(message, args) {
    let response = _.sample(brooklyn_99_quotes);
    return message.reply(`\n${response}`);
  },
};
