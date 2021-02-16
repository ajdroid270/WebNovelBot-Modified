const cheerio = require("cheerio");
const fetch = require("node-fetch");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");
const cloudscraper = require("cloudscraper");
const {
  nuSearchShort,
  nuScrapeMetadata,
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
  nuSearchLong,
} = require("../helper");

module.exports = {
  name: "ww",
  siteNovelPrefix: "https://www.wuxiaworld.com/novel/",
  description: `Scrape chapters from the given link for the specified N number of chapters!`,
  usage: `${prefix}ww link *N`,
  example: `${prefix}ww https://www.wuxiaworld.com/novel/martial-god-asura/mga-chapter-1 60`,
  args: true,
  guildOnly: true,
  experimental: false,
  async getMetaData(novelHomePageLink) {
    let metadata = {};
    var options = cloudscraper.defaultParams;
    options = {
      ...options,
      method: "GET",
      uri: novelHomePageLink,
      // Cloudscraper automatically parses out timeout required by Cloudflare.
      // Override cloudflareTimeout to adjust it.
      cloudflareTimeout: 5000,
      // Reduce Cloudflare's timeout to cloudflareMaxTimeout if it is excessive
      cloudflareMaxTimeout: 30000,
      // followAllRedirects - follow non-GET HTTP 3xx responses as redirects
      followAllRedirects: true,
    };
    let page = await cloudscraper(options);
    const $ = cheerio.load(page);
    console.time("metadata");
    metadata.title = $("div.novel-container div.novel-body h2").text().trim();
    metadata.description = $("div.fr-view").text().trim();
    metadata.publisher = "www.WuxiaWorld.Com";
    metadata.originalPublisher = $(
      "div.novel-body div:nth-of-type(2) div:nth-child(2) dd"
    )
      .text()
      .trim();
    metadata.author = $("div.novel-body div:nth-of-type(2) div:nth-child(1) dd")
      .text()
      .trim();
    let count = 0;
    do {
      metadata.cover = $("div.novel-left img.media-object.img-thumbnail")
        .first()
        .attr("src");
      count++;
    } while (!metadata.cover && count < 3);
    metadata.chapters = $("ul.list-unstyled.list-chapters>li.chapter-item>a")
      .map((i, el) => {
        let e = $(el);
        return {
          link: `${this.siteNovelPrefix}${e
            .attr("href")
            .toString()
            .replace("/novel/", "")}/`,
          name: e.text().trim(),
        };
      })
      .toArray();
    console.timeEnd("metadata");
    return metadata;
  },
  async execute(message, args) {
    let isProvidedLinkHome = false;
    let novelSlug = "";
    let providedLink = args[0];
    let startingChapterLink =
      _.last(providedLink) === "/" ? providedLink : `${providedLink}/`;
    let startingChapterIndex = 0;
    let currentChapterIndex = 0;
    let novelHomePageLink = "";
    let novelMetaData = {};
    let chapterCount = 0;
    let chapterLimit = _.isNaN(args[1]) ? null : args[1];
    let bookContent = [];

    if (!startingChapterLink.includes("wuxiaworld.com")) {
      return message.reply(`\`ww\` command only supports wuxiaworld novels.`);
    }
    novelSlug = startingChapterLink
      .replace(this.siteNovelPrefix, "")
      .split("/")[0];
    if (
      `${this.siteNovelPrefix}${novelSlug}/` === startingChapterLink ||
      `${this.siteNovelPrefix}${novelSlug}` === startingChapterLink
    ) {
      isProvidedLinkHome = true;
    }
    novelHomePageLink = `${this.siteNovelPrefix}${novelSlug}/`;
    // console.log({ novelHomePageLink });
    novelMetaData = await this.getMetaData(novelHomePageLink);
    console.log(novelMetaData.cover);
    // return;
    startingChapterIndex = isProvidedLinkHome
      ? 0
      : novelMetaData.chapters.findIndex((v, i) => {
          if (
            v.link.includes(startingChapterLink) ||
            startingChapterLink.includes(v.link)
          ) {
            return true;
          }
        });
    currentChapterIndex = startingChapterIndex;
    let currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
    let nextChapterExists = true;
    let processingMessage;
    let bookTitle = novelMetaData.title;
    let bookAuthor = novelMetaData.author;
    let bookCoverArt = novelMetaData.cover;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    let numTries = 1;
    while (currentChapterIndex < novelMetaData.chapters.length) {
      try {
        if (numTries >= 10) break;
        console.log("processing: " + currentChapterLink);
        var options = cloudscraper.defaultParams;
        options = {
          ...options,
          method: "GET",
          uri: currentChapterLink,
          // Cloudscraper automatically parses out timeout required by Cloudflare.
          // Override cloudflareTimeout to adjust it.
          cloudflareTimeout: 5000,
          // Reduce Cloudflare's timeout to cloudflareMaxTimeout if it is excessive
          cloudflareMaxTimeout: 30000,
          // followAllRedirects - follow non-GET HTTP 3xx responses as redirects
          followAllRedirects: true,
        };
        let page = await cloudscraper(options);
        // console.log(page);
        page.replace("Previous Chapter", "");
        const $ = cheerio.load(page);
        !bookTitle
          ? (bookTitle = $("a>h4", "li.caption").first().text().trim())
          : null;
        const chapterName = novelMetaData.chapters[currentChapterIndex].name;
        $("div#chapter-content>p>strong").remove();
        $("div#chapter-content>script").remove();
        $("div#chapter-content>a").remove();
        const chapterContent = "<hr/>" + $("div#chapter-content").html();
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        }
        chapterCount++;
        console.log(`chapters processed: ${chapterCount}`);
        currentChapterIndex++;
        currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
        let instructionText = `React with \:pause_button: to make epub with currently processed chapters.\nReact with \:stop_button: to cancel the process.`;
        if (processingMessage) {
          chapterCount % 5 == 0
            ? processingMessage.edit(`chapters processed: ${chapterCount}`)
            : null;
        } else {
          processingMessage = await message.channel.send(
            `chapters processed: ${chapterCount}`
          );
          const filter = (reaction, user) => {
            return true;
          };
        }
        if (chapterCount >= chapterLimit) {
          break;
        }
        numTries = 1;
      } catch (error) {
        console.log(error.message);
        console.log(`trying to load ${currentChapterLink} again`);
        numTries++;
      }
    }

    try {
      processingMessage.edit(`making epub!`);
    } catch (error) {
      console.log(error);
    }

    try {
      const option = {
        title: bookTitle, // *Required, title of the book.
        author: bookAuthor, // *Required, name of the author.
        publisher: "WuxiaWorld", // optional
        cover: bookCoverArt,
        content: bookContent,
        version: 2,
        css: customCss,
      };

      if (!cancelProcess) {
        new Epub(
          option,
          path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`)
        ).promise
          .then(async () => {
            let fileStat = fs.lstatSync(
              path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`)
            );
            if (fileStat.size > 8000000) {
              let file = await uploadFileToDrive(
                path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`),
                driveTmpFolder,
                `${bookTitle}_${Date.now()}.epub`
              );
              let embed = await getDriveEmbed(file);
              message.reply(embed);
            } else {
              await message
                .reply({
                  files: [
                    path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`),
                  ],
                })
                .catch((error) => console.log(error.message));
            }
            fs.unlink(
              path.resolve(process.cwd(), `./epubs/${bookTitle}.epub`),
              () => {}
            );
            processingMessage.delete();
          })
          .catch((err) => console.error(err.message));
      } else {
        processingMessage.delete();
        message.channel.send("Process stopped.");
      }
    } catch (error) {
      console.log(error);
    }
  },
};
