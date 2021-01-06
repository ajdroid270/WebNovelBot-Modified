const configVars = require("../EnvLoader");
const { prefix, miscData } = configVars.env;
module.exports = {
  name: "sites",
  description: "Lists all currently supported sites.",
  usage: `${prefix}sites`,
  example: `${prefix}sites`,
  guildOnly: false,
  args: false,
  execute(message, args) {
    var sites = miscData.sites;
    message.reply(
      "WebnovelBot currently supports the following sites:\n" + sites.join("")
    );
  },
};
