const FormData = require("form-data");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const urlMetadata = require("url-metadata");

module.exports = {
  name: "nu",
  description: "Search for novel on Novel Updates",
  args: true,
  usage: `${prefix}nu <novel name>`,
  example: `${prefix}nu mar god or ${prefix}nu mga`,
  guildOnly: true,
  execute(message, args) {
    let start = Date.now();
    let end = Date.now();
    function sendList(message, list, options) {
      // message.channel.send(list);
      list.forEach((item, i) => {
        message.channel.send({ embed: item });
      });
    }
    if (!args.length) {
      return message.reply(`You didn't provide any arguments!`);
    }
    let searchString = args.join(` `); //msgStr.slice(3)
    console.log(`${message.author.username}: ${searchString}`);

    async function nuSearchShort(searchString) {
      var form = new FormData();
      form.append("action", "nd_ajaxsearchmain");
      form.append("strType", "desktop");
      form.append("strOne", searchString);
      form.append("strSearchType", "series");
      console.time("Fetch novel search results");
      var result = await fetch(
        `https://www.novelupdates.com/wp-admin/admin-ajax.php`,
        { method: "POST", body: form }
      )
        .then((res) => res.text())
        .catch((err) => console.log(err.message));
      console.timeEnd("Fetch novel search results");
      // result = result.substring(0, result.length - 1);
      const $ = cheerio.load(result);
      var l = [];
      let elements = $(`a[class=a_search]`);
      console.time("loop novels");
      for (var i = 0; i < elements.length; i++) {
        console.time("new loop");
        el = elements[i];
        const link = el.attribs.href;
        let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));
        let shortLink = link.replace(
          "https://www.novelupdates.com/series/",
          ""
        );
        if (regex.test(shortLink)) {
          let metadata = await urlMetadata(link);
          // console.log(metadata);
          let name = shortLink
            .replace("/", "")
            .split("-")
            .join(" ")
            .toUpperCase();
          l.push({
            title: `${metadata.title}`,
            description: `${metadata.description}`,
            url: metadata.url,
            thumbnail: {
              url: `${metadata["og:image"]}`,
            },
            image: {
              url: `${metadata["og:image"]}`,
            },
            author: {
              name: `${metadata.author}`,
            },
            color: 5019476,
          });
        }
        console.timeEnd("new loop");
      }
      console.timeEnd("loop novels");
      end = Date.now();
      return l;
    }

    async function nuSearchLong(args) {
      console.time("Fetch novel data");
      var result = await fetch(
        `https://www.novelupdates.com/?s=${args.join(
          "+"
        )}&post_type=seriesplans`
      ).then((res) => res.text());
      console.timeEnd("Fetch novel data");
      const $ = cheerio.load(result);
      let l = [];
      let elements = $(`div.search_title>a`);
      console.time("loop novels");
      for (var i = 0; i < elements.length; i++) {
        console.time("new loop");
        el = elements[i];
        let link = el.attribs.href;
        var regex = RegExp(`${args.join("[^>]*?")}`, "gi");
        let shortLink = link.replace(
          "https://www.novelupdates.com/series/",
          ""
        );
        if (regex.test(shortLink)) {
          let metadata = await urlMetadata(link);
          // console.log(metadata);
          let name = shortLink
            .replace("/", "")
            .split("-")
            .join(" ")
            .toUpperCase();
          l.push({
            title: metadata.title,
            description: `${metadata.description}`,
            url: metadata.url,
            thumbnail: {
              url: `${metadata["og:image"]}`,
            },
            image: {
              url: `${metadata["og:image"]}`,
            },
            author: {
              name: `${metadata.author}`,
            },
            color: 5019476,
          });
        }
        console.timeEnd("new loop");
      }
      console.timeEnd("loop novels");
      end = Date.now();
      return l;
    }

    /* (async () => {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto('https://www.novelupdates.com/');
            let el1 = await page.$(`input[name='s']`);
            // console.log(el1);
            await page.click(`span.menu_right_icons.search`);
            await page.type(`input[name='s']`, searchString);
            await page.screenshot({ path: 'example.png' });
            page.waitForSelector('li.search_li_results').then(()=>{
                let result = page.$$('li.search_li_results>a.a_search',el => el.href);
                console.log(result);
            })
            await browser.close();
        })(); */

    /* $.ajax({
            type: `POST`,
            url: `https://www.novelupdates.com/wp-admin/admin-ajax.php`,
            data: { action: `nd_ajaxsearchmain`, strType: `desktop`, strOne: `series`, strSearchType: msgStr },
            success:
                function (e) {
                    e = e.slice(0, -1)
                    console.log(e);
                }
        }); */

    if (args.length == 1) {
      nuSearchShort(args[0])
        .then((res) => {
          console.log(res);
          switch (res.length) {
            case 0:
              message.channel.send("Nothing Found");
            default:
              message.channel.send({
                content: `Obtained ${res.length} result(s) ${(
                  (end - start) /
                  1000
                ).toFixed(2)} seconds.`,
              });
              sendList(message, res);
            // message.channel.send('Reply with n to select option n\n'+`Enter a number in the range 1 to ${res.length}`).then(getReply(message));
          }
        })
        .catch((err) => console.log(err.message));
    } else {
      nuSearchLong(args).then((res) => {
        console.log(res);
        switch (res.length) {
          case 0:
            message.channel.send("Nothing Found");
          default:
            message.channel.send({
              content: `Obtained ${res.length} result(s) in ${(
                (end - start) /
                1000
              ).toFixed(2)} seconds.`,
            });
            sendList(message, res);
          // message.channel.send('Reply with ``n`` to select option n').then(getReply(message));
        }
      });
    }
  },
};
