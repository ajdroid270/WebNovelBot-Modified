const cheerio = require("cheerio");
const fetch = require("node-fetch");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const _s = require("underscore.string");
const path = require("path");
const fs = require("fs");
const cloudscraper = require("cloudscraper");
const {
  nuSearchShort,
  nuScrapeMetadata,
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
  generateEpub,
} = require("../helper");

module.exports = {
  name: "rln",
  siteNovelPrefix: "https://www.readlightnovel.org/",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}rln <link> *N`,
  example: `${prefix}rln https://www.readlightnovel.org/warlock-of-the-magus-world/chapter-1 60`,
  args: true,
  guildOnly: false,
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
    metadata.title = $(
      "div.container--content div.block-header div.block-title"
    )
      .first()
      .text()
      .trim();
    metadata.description = $(
      "div.novel-right div.novel-details div.novel-detail-item:nth-child(1) div.novel-detail-body"
    )
      .text()
      .trim()
      .split("\n\n")
      .join("\n");
    metadata.publisher = "www.readlightnovel.org";
    metadata.author = $(
      "div.novel-left div.novel-details div.novel-detail-item:nth-child(5) div.novel-detail-body"
    )
      .text()
      .trim();
    let count = 0;
    do {
      metadata.cover = $("div.novel div.novel-left div.novel-cover img")
        .first()
        .attr("src");
      count++;
    } while (!metadata.cover && count < 3);
    metadata.status = $(
      "div.novel-left div.novel-details div.novel-detail-item:nth-child(8) div.novel-detail-body"
    )
      .text()
      .trim();
    metadata.chapters = $("div.panel-body div.tab-content ul.chapter-chs li a")
      .map((i, el) => {
        let e = $(el);
        let chapName = e.text().trim();
        return {
          link: e.attr("href").toString() + "/",
          name: chapName.includes("CH ")
            ? chapName.replace("CH ", "Chapter ")
            : chapName.toLowerCase().includes("chapter")
            ? chapName
            : `Chapter ${chapName}`,
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
    let currentChapterLink = startingChapterLink;

    if (!currentChapterLink.includes("readlightnovel.org")) {
      return message.reply(
        `\`rln\` command only supports readlightnovel novels.`
      );
    }
    novelSlug = currentChapterLink
      .replace(this.siteNovelPrefix, "")
      .split("/")[0];
    if (
      `${this.siteNovelPrefix}${novelSlug}/` === startingChapterLink ||
      `${this.siteNovelPrefix}${novelSlug}` === startingChapterLink
    ) {
      isProvidedLinkHome = true;
    }
    novelHomePageLink = `${this.siteNovelPrefix}${novelSlug}/`;
    console.log({ novelHomePageLink });
    novelMetaData = await this.getMetaData(novelHomePageLink);
    console.log(novelMetaData);
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
    currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
    let processingMessage;
    let bookTitle = novelMetaData.title;
    let bookAuthor = novelMetaData.author;
    let bookCoverArt = novelMetaData.cover;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    // return;
    let numTries = 1;
    while (currentChapterIndex < novelMetaData.chapters.length) {
      console.log({
        currentChapterIndex,
        totalChapters: novelMetaData.chapters.length,
      });
      try {
        if (numTries >= 10) break;
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
        const $ = cheerio.load(page);
        console.log({
          currentChapter: novelMetaData.chapters[currentChapterIndex],
        });
        const chapterName = novelMetaData.chapters[currentChapterIndex].name;
        $("div.trinity-player-iframe-wrapper").remove();
        $("script").remove();
        $("hr").remove();
        $("img").remove();
        $(".ads-title").remove();
        $("div#growfoodsmart.hidden").remove();
        currentChapterIndex++;
        currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
        const chapterContent =
          "<hr/>" + $("div.chapter-content3 > div.desc").html();
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        }
        chapterCount++;
        console.log(`chapters processed: ${chapterCount}`);
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
        console.log(error);
        if (error.statusCode === 404) {
          currentChapterIndex++;
          currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
        }
        console.log(`trying to load ${currentChapterLink} again`);
        numTries++;
      }
    }

    try {
      processingMessage.edit(`making epub!`);
    } catch (error) {
      console.log(error);
    }

    const option = {
      title: bookTitle, // *Required, title of the book.
      author: bookAuthor, // *Required, name of the author.
      publisher: "ReadLightNovel", // optional
      cover: bookCoverArt,
      content: bookContent,
      version: 2,
      css: customCss,
    };

    if (!cancelProcess) {
      generateEpub(
        option,
        bookTitle,
        driveTmpFolder,
        message,
        processingMessage
      );
    } else {
      processingMessage.delete();
      message.channel.send("Process stopped.");
    }
  },
};
