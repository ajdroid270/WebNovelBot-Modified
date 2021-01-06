const { prefix } = process.env;
module.exports = {
  name: "ping",
  description: "Replies with a Pong :ping_pong:",
  usage: `${prefix}ping`,
  example: `${prefix}ping`,
  guildOnly: false,
  args: false,
  execute(message, args) {
    message.channel.send("Pong  :ping_pong:");
  },
};
