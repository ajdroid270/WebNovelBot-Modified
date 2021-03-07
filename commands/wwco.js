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
  wwcoScrapeMetadata,
  generateEpub,
} = require("../helper");

module.exports = {
  name: "wwco",
  siteNovelPrefix: "https://www.wuxiaworld.co/",
  description: `Scrape chapters from the given link for the specified N number of chapters!`,
  usage: `${prefix}wwco link *N`,
  example: `${prefix}wwco https://m.wuxiaworld.co/The-Second-Coming-of-Gluttony/5013560.html 60`,
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
    metadata.title = $("div.book-info div.book-name").text().trim();
    metadata.description = $(
      "div.about-wrapper div.synopsis div.content p.desc"
    )
      .text()
      .trim()
      .split("\n\n")
      .join("\n");
    metadata.publisher = "WuxiaWorld.Co";
    metadata.author = $("div.person-info div.author span.name").text().trim();
    let count = 0;
    do {
      metadata.cover = $("div.book-img img").first().attr("src");
      count++;
    } while (!metadata.cover && count < 3);
    metadata.status = $("div.book-info div.base-info div.book-state")
      .text()
      .trim();
    metadata.chapters = $("ul.chapter-list a.chapter-item")
      .map((i, el) => {
        let e = $(el);
        let chapName = e.text().trim();
        return {
          link: `${this.siteNovelPrefix}${e.attr("href").toString().slice(1)}`,
          name: chapName.toLowerCase().includes("chapter")
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
    if (!currentChapterLink.includes("wuxiaworld.co/")) {
      return message.reply(`\`ww\` command only supports wuxiaworld novels.`);
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
    // console.log(novelMetaData);
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
    let numTries = 1;
    while (currentChapterIndex < novelMetaData.chapters.length) {
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
        const $ = cheerio.load(page);
        // !bookTitle
        //   ? (bookTitle = $(
        //       "div.read-container > div.book-wrapper > div.book-name"
        //     )
        //       .text()
        //       .trim())
        //   : null;
        // !bookAuthor
        //   ? (bookAuthor = $(
        //       "div.read-container > div.book-wrapper > div.author > span.author-name"
        //     ).text())
        //   : null;
        const chapterName = novelMetaData.chapters[currentChapterIndex].name;
        $("script").remove();
        $("h1.chapter-title").remove();
        $("ins").remove();
        // $("br").append("<p>\n</p>");
        const chapterContent =
          "<hr/><div>" +
          $("#section-list-wp > section.section > div.chapter-entity")
            .html()
            .trim() +
          "</div>";
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        }
        // console.log(chapterContent);
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
        currentChapterIndex++;
        currentChapterLink = novelMetaData.chapters[currentChapterIndex].link;
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
