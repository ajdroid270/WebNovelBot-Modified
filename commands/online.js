const { prefix } = process.env;
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
