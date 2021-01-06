const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
module.exports = {
  name: "online",
  description: "Replies with bot connection status",
  args: false,
  usage: `${prefix}online`,
  example: `${prefix}online`,
  guildOnly: true,
  execute(message, args) {
    message.reply(` The bot is online :thumbsup:`);
  },
};
