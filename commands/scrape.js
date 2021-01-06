const { prefix } = process.env;
module.exports = {
  name: "scrape",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  aliases: ["grab", "web"],
  usage: `${prefix}scrape link *N`,
  example: `${prefix}scrape https://m.wuxiaworld.co/The-Second-Coming-of-Gluttony/5013560.html 60`,
  guildOnly: false,
  args: true,
  execute(message, args, client) {
    const link = args[0];
    let isLink = link.includes("https://");
    let commandName = "ww";
    if (!isLink) {
      commandName = "help";
      args = ["scrape"];
    } else {
      let site = link.replace("https://", "").split("/")[0];
      console.log(site);
      switch (site) {
        case "www.wuxiaworld.com":
          commandName = "ww";
          break;
        case "www.wuxiaworld.co":
          commandName = "wwco";
          break;
        case "wuxiaworld.site":
          commandName = "wwsite";
          break;
        case "www.readlightnovel.org":
          commandName = "rln";
          break;
        case "boxnovel.com":
          commandName = "box";
          break;
        case "vipnovel.com":
          commandName = "vip";
          break;
        case "lnmtl.com":
          commandName = "lnmtl";
          break;
        case "www.mtlnovel.com":
          commandName = "mtln";
          break;
        default:
          commandName = "sites";
          break;
      }
    }
    const command =
      client.commands.get(commandName) ||
      client.commands.find(
        (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
      );
    command.execute(message, args, client);
  },
};
