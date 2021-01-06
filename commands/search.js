const cheerio = require("cheerio");
const fetch = require("node-fetch");
const { prefix } = process.env;
const _ = require("underscore");

module.exports = {
  name: "search",
  description:
    "Search for a novel on All supported sites.\n**NOTE: Search is sensitive to special charachter like ; :**",
  args: true,
  usage: `${prefix}search <novel name>`,
  example: `${prefix}search mar god`,
  guildOnly: true,
  async execute(message, args) {
    let list = [];
    let masterList = [];
    let start = Date.now();
    let end = Date.now();
    function sendList(list, masterList) {
      let data = "";
      list.forEach((item, i) => {
        prevData = data;
        data += `[${item}](${masterList[i]})\n`;
        if (data.length >= 2048) data = prevData;
      });
      console.log(data);
      message.channel.send({
        content: "Enter index of the novel for detailed info!",
        embed: {
          title: "WebnovelBot Search",
          description: data,
          color: 5019476,
        },
      });
    }
    if (!args.length) {
      return message.reply(`You didn't provide any arguments!`);
    }
    let searchString = args.join(` `);
    searchString = searchString.toLowerCase();
    console.log(`${message.author.username}: ${searchString}`);

    async function wwSearch(searchString) {
      let l = [];
      var result = await fetch(
        `https://www.wuxiaworld.com/api/novels/search?query=${searchString}&count=15`,
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9,te;q=0.8",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
          },
          referrer: "https://www.wuxiaworld.com/",
          referrerPolicy: "no-referrer-when-downgrade",
          body: null,
          method: "GET",
          mode: "cors",
        }
      ).then((res) => res.json());
      if (result.items.length <= 0) return [];
      result.items.forEach((novel, i, arr) => {
        console.log(novel);
        list.push(`${list.length + 1} - ${novel.name} -- wuxiaworld.com`);
        masterList.push(`https://www.wuxiaworld.com/novel/${novel.slug}`);
      });

      /* for (novel of result.items) {
                l.push({
                    "title": `${novel.name}`,
                    'description': `${novel.synopsis}`,
                    'url': `https://www.wuxiaworld.com/novel/${novel.slug}`,
                    'image': {
                        'url': novel.coverUrl,
                    },
                    'author': {
                        'name': `WuxiaWorld`
                    },
                    "fields": [
                        {
                            "name": "Status:",
                            "value": `${novel.tags[1]}`
                        },
                        {
                            "name": "Chapter Count:",
                            "value": `${novel.chapterCount}`
                        }
                    ],
                    "color": 5019476,
                });
            } */
      end = Date.now();
      return list;
    }

    async function boxSearch(searchString) {
      let l = [];
      var form = new URLSearchParams();
      form.append("action", "wp-manga-search-manga");
      form.append("title", searchString);
      var result = await fetch("https://boxnovel.com/wp-admin/admin-ajax.php", {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "en-US,en;q=0.9,te;q=0.8",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
        },
        referrer: "https://boxnovel.com/",
        referrerPolicy: "no-referrer-when-downgrade",
        body: form,
        method: "POST",
        mode: "cors",
      }).then((res) => res.json());
      console.log(result);
      // return [];
      if (!result.success) return [];
      result.data.forEach((novel, i, arr) => {
        let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));
        // console.log(regex.test(novel.title.toLowerCase()));
        if (regex.test(novel.title.toLowerCase())) {
          list.push(`${list.length + 1} - ${novel.title} -- boxnovel.com`);
          masterList.push(novel.url);
        }
      });

      /* for (novel of result.data) {
                l.push({
                    "title": `${novel.title}`,
                    'url': novel.url,
                    "color": 5019476,
                });
            } */
      end = Date.now();
      return list;
    }

    async function wwcoSearch(searchString) {
      urlSearchString = searchString.split(" ").join("%20") + "/1";
      let l = [];
      var result = await fetch(
        `https://www.wuxiaworld.co/search/${urlSearchString}/1`,
        {
          headers: {
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "accept-language": "en-US,en;q=0.9,te;q=0.8",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
          },
          referrer: "https://www.wuxiaworld.co/search/key/1",
          referrerPolicy: "no-referrer-when-downgrade",
          body: null,
          method: "GET",
          mode: "cors",
        }
      ).then((res) => res.text());
      // console.log(result);
      if (result.includes("No results for your search.")) return [];
      const $ = cheerio.load(result);
      $(
        `div.result-wrapper > div.result-container_2.result-container > ul.result-list > li.list-item`
      ).each(function (i, el) {
        metadata = {};
        let a = $("a", this);
        let img = $("img", this);
        metadata.link = `https://www.wuxiaworld.co${a.attr("href")}`;
        metadata.img = img.attr("src");
        metadata.author = [
          `${$("div.item-info > a.book-name > font", this).text()}`,
        ];
        $("div.item-info > a.book-name > font", this).remove();
        metadata.title = `${$("div.item-info > a.book-name", this).text()}`;
        console.log(
          metadata.title + " : " + metadata.author + " : " + metadata.img
        );
        // return[];
        let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));

        if (regex.test(metadata.title.toLowerCase())) {
          list.push(`${list.length + 1} - ${metadata.title} -- wuxiaworld.co`);
          masterList.push(metadata.link);
        }

        /* if (regex.test(metadata.title.toLowerCase())) {
                    l.push({
                        "title": `${metadata.title}`,
                        'description': `${metadata.description}`,
                        'url': metadata.url,
                        'thumbnail': {
                            'url': `${metadata["og:image"]}`,
                        },
                        'image': {
                            'url': `${metadata["og:image"]}`,
                        },
                        'author': {
                            'name': `${metadata.author}`
                        },
                        "color": 5019476,
                    });
                } */
      });
      return list;
    }

    async function rlnSearch(searchString) {
      let l = [];
      var form = new URLSearchParams();
      form.append("q", searchString);
      var result = await fetch(
        "https://www.readlightnovel.org/search/autocomplete",
        {
          headers: {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9,te;q=0.8",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
          },
          referrer: "https://www.readlightnovel.org/",
          referrerPolicy: "no-referrer-when-downgrade",
          body: form,
          method: "POST",
          mode: "cors",
        }
      ).then((res) => res.text());
      console.log(result);
      if (result.length <= 0) return [];
      const $ = cheerio.load(result);
      $(`li`).each(function (i, el) {
        metadata = {};
        let a = $("a", this);
        let img = $("img", this);
        metadata.link = `${a.attr("href")}`;
        metadata.img = `${img.attr("src")}`;
        metadata.title = `${$("span.title", this).text()}`;
        console.log(metadata.title + " : " + metadata.img);
        // return[];
        let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));

        if (regex.test(metadata.title.toLowerCase())) {
          list.push(
            `${list.length + 1} - ${metadata.title} -- readlightnovel.org`
          );
          masterList.push(metadata.link);
        }

        /* if (regex.test(metadata.title.toLowerCase())) {
                    l.push({
                        "title": `${metadata.title}`,
                        'description': `${metadata.description}`,
                        'url': metadata.url,
                        'thumbnail': {
                            'url': `${metadata["og:image"]}`,
                        },
                        'image': {
                            'url': `${metadata["og:image"]}`,
                        },
                        'author': {
                            'name': `${metadata.author}`
                        },
                        "color": 5019476,
                    });
                } */
      });
      return list;
    }

    async function wwsiteSearch(searchString) {
      let l = [];
      var form = new URLSearchParams();
      form.append("action", "wp-manga-search-manga");
      form.append("title", searchString);
      var result = await fetch(
        "https://wuxiaworld.site/wp-admin/admin-ajax.php",
        {
          headers: {
            accept: "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9,te;q=0.8",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
            cookie: "__cfduid=debe1353ac1cb8143ff532ccf6248ddd91599226505",
          },
          referrer: "https://wuxiaworld.site/",
          referrerPolicy: "no-referrer-when-downgrade",
          body: form,
          method: "POST",
          mode: "cors",
        }
      ).then((res) => res.json());
      console.log(result);
      // return [];
      if (!result.success) return [];
      result.data.forEach((novel, i, arr) => {
        let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));
        // console.log(regex.test(novel.title.toLowerCase()));
        if (regex.test(novel.title.toLowerCase())) {
          list.push(`${list.length + 1} - ${novel.title} -- wuxiaworld.site`);
          masterList.push(novel.url);
        }
      });

      /* for (novel of result.data) {
                l.push({
                    "title": `${novel.title}`,
                    'url': novel.url,
                    "color": 5019476,
                });
            } */
      end = Date.now();
      return list;
    }

    async function vipnovelSearch(searchString) {
      let l = [];
      var form = new URLSearchParams();
      form.append("action", "wp-manga-search-manga");
      form.append("title", searchString);
      var result = await fetch("https://vipnovel.com/wp-admin/admin-ajax.php", {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "en-US,en;q=0.9,te;q=0.8",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
        },
        referrer: "https://vipnovel.com/",
        referrerPolicy: "no-referrer-when-downgrade",
        body: form,
        method: "POST",
        mode: "cors",
      }).then((res) => res.json());
      console.log(result);
      // return [];
      if (!result.success) return [];
      result.data.forEach((novel, i, arr) => {
        let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));
        // console.log(regex.test(novel.title.toLowerCase()));
        if (regex.test(novel.title.toLowerCase())) {
          list.push(`${list.length + 1} - ${novel.title} -- vipnovel.com`);
          masterList.push(novel.url);
        }
      });

      /* for (novel of result.data) {
                l.push({
                    "title": `${novel.title}`,
                    'url': novel.url,
                    "color": 5019476,
                });
            } */
      end = Date.now();
      return list;
    }

    try {
      let ww = await wwSearch(searchString);
      let box = await boxSearch(searchString);
      let wwco = await wwcoSearch(searchString);
      let wwsite = await wwsiteSearch(searchString);
      let vipnovel = await vipnovelSearch(searchString);
      let rln = await rlnSearch(searchString);
    } catch (error) {
      console.log(error);
    }
    // list.push(...ww);
    // list.push(...box);
    if (list.length) {
      // message.channel.send(list);
      // await message.reply('Enter index of the novel for detailed info!');
      sendList(list, masterList);
      const filter = (m) => {
        return m.author.id == message.author.id;
      };
      const collector = message.channel.createMessageCollector(filter, {
        max: 1,
        time: 60000,
      });
      collector.on("collect", async (m) => {
        console.log(`Collected ${m.content}`);
        selectedOption = m.content;
        let num = +selectedOption.trim();
        if (_.isNumber(num) && num > 0 && num <= list.length) {
          message.channel.send(masterList[num - 1]);
        } else {
          message.channel.send("Invalid Selection!");
        }
      });

      collector.on("end", (collected) => {
        collected.size
          ? null
          : message.reply(
              "Selection Timeout! Use `!drive <name>` to get the epub."
            );
        console.log(`Collected ${collected.size} items`);
      });
    } else {
      let noMatchesMessage = message.channel.send(
        `No matches for \`${args.join(" ")}\` !`
      );
      message.delete();
      setTimeout(() => {
        try {
          noMatchesMessage.delete();
        } catch (error) {
          console.log(error.message);
        }
      }, 60000);
    }
  },
};
