const cheerio = require("cheerio");
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");
const cloudscraper = require("cloudscraper");
const {
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
  generateEpub,
} = require("../helper");

module.exports = {
  name: "mtln",
  siteNovelPrefix: "https://www.mtlnovel.com/",
  description: `Scrape chapters from the given link for the specified N number of chapters!`,
  usage: `${prefix}mtln link *N`,
  example: `${prefix}mtln https://www.mtlnovel.com/douluo-dalu-4-final-douluo/chapter-1-what-is-that-repair 60`,
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
    $("span.manga-title-badges").remove();
    metadata.title = $("div.m-card.single-page > h1.entry-title").text().trim();
    metadata.description = $("div#panelnovelinfo > div.desc").text().trim();
    metadata.publisher = "www.mtlnovel.com";
    metadata.author = $(
      "#panelnovelinfo > table > tbody > tr:nth-child(4) > td:nth-child(3) > a"
    )
      .text()
      .trim();
    let count = 0;
    do {
      metadata.cover = $(
        "body > main > article > div.m-card.single-page > div.post-content > div > amp-img > amp-img"
      ).attr("src");
      count++;
    } while (!metadata.cover && count < 3);
    let chaptersListPage = await cloudscraper(
      novelHomePageLink + "chapter-list/"
    );
    console.log({ novelChaptersPageLink: novelHomePageLink + "chapter-list/" });
    const $$ = cheerio.load(chaptersListPage);
    metadata.chapters = $$("div.post-content > div.ch-list a.ch-link")
      .map((i, el) => {
        let e = $$(el);
        return {
          link: e.attr("href").toString().trim(),
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

    if (!startingChapterLink.includes("www.mtlnovel.com")) {
      return message.reply(
        `\`mtln\` command only supports www.mtlnovel.com novels.`
      );
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
    novelMetaData = await this.getMetaData(novelHomePageLink);
    // console.log(novelMetaData);
    // return;
    startingChapterIndex = isProvidedLinkHome
      ? novelMetaData.chapters.length - 1
      : novelMetaData.chapters.findIndex((v) => {
          if (
            v.link.includes(startingChapterLink) ||
            startingChapterLink.includes(v.link)
          ) {
            return true;
          }
        });
    startingChapterLink = novelMetaData.chapters[startingChapterIndex].link;
    currentChapterIndex = startingChapterIndex;
    let currentChapterLink = startingChapterLink;

    let processingMessage;
    let bookTitle = novelMetaData.title;
    let bookAuthor = novelMetaData.author;
    let bookCoverArt = novelMetaData.cover;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    let numTries = 1;
    var options = cloudscraper.defaultParams;
    // console.log({ currentChapterIndex });
    while (currentChapterIndex >= 0) {
      currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
      // console.log("Current Chapter Link: " + currentChapterLink);
      try {
        if (numTries >= 10) break;
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
        let chapterName = $(
          "div.m-card.single-page > div.crumbs > span.current-crumb"
        )
          .first()
          .text()
          .trim();
        if (
          chapterName.length > novelMetaData.chapters[currentChapterIndex].name
        ) {
          novelMetaData.chapters[currentChapterIndex].name = chapterName;
        } else {
          chapterName = novelMetaData.chapters[currentChapterIndex].name;
        }
        const chapterContent = "<hr/>" + $("div.post-content > div.par").html();
        if ($("div.post-content > div.par img").length) {
          console.log("Current Chapter Link: " + currentChapterLink);
          console.log(
            "Image Link: " +
              $("div.post-content > div.par img").first().attr("href")
          );
        }
        $("div.ads").remove();
        $("amp-iframe").remove();
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        }
        chapterCount++;
        console.log(`chapters processed: ${chapterCount}`);
        // let instructionText = `React with \:pause_button: to make epub with currently processed chapters.\nReact with \:stop_button: to cancel the process.`;
        if (processingMessage) {
          chapterCount % 5 == 0
            ? processingMessage.edit(`chapters processed: ${chapterCount}`)
            : null;
        } else {
          processingMessage = await message.channel.send(
            `chapters processed: ${chapterCount}`
          );
          // const filter = (reaction, user) => {
          //   return true;
          // };
        }
        if (chapterCount >= chapterLimit) {
          break;
        }
        numTries = 1;
        currentChapterIndex--;
        currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
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

    const option = {
      title: bookTitle, // *Required, title of the book.
      author: bookAuthor, // *Required, name of the author.
      publisher: "MTLNovel", // optional
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
