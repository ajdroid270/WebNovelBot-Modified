const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
module.exports = {
  name: "prune",
  description:
    "Prunes the specified number of messages (defaults to 10) within the last 2 weeks. `the number should be between 1 and 99`",
  aliases: ["clear", "delete"],
  usage: `${prefix}prune *<number of messages to prune>`,
  example: `${prefix}ping 20`,
  guildOnly: false,
  args: false,
  execute(message, args) {
    const amount = parseInt(args[0]) + 1;
    if (message.member.hasPermission("MANAGE_MESSAGES")) {
      if (isNaN(amount)) {
        return message.channel.send(
          `Pruning the last 10 messages in the last 2 weeks.`
        );
      } else if (amount <= 1 || amount > 100) {
        return message.reply(`you need to input a number between 1 and 99.`);
      }
      message.channel.bulkDelete(amount, true).catch((err) => {
        console.error(err);
        message.reply(
          `there was an error trying to prune messages in this channel! \n${err.message}`
        );
      });
    } else {
      message.reply(`You don't have permission to delete messages!`);
    }
  },
};
