const FormData = require("form-data");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const fetchcookie = require("fetch-cookie")(fetch);
const fetchcookieRedirect = require("fetch-cookie/node-fetch")(fetch);
const configVars = require("../EnvLoader");
const { prefix } = configVars.env;
const Epub = require("epub-gen");
const _ = require("underscore");
const _s = require("underscore.string");
const path = require("path");
const fs = require("fs");
const cookies = configVars.env.cookies;
const miscData = configVars.env.miscData;
const lnmtlAccounts = miscData.accounts;
const {
  nuSearchShort,
  nuScrapeMetadata,
  uploadFileToDrive,
  driveTmpFolder,
  getDriveEmbed,
  lnmtlScrapeMetadata,
  lnmtlLogin,
  parseCookies,
  getGetOptions,
} = require("../helper");
var isLoggedIn = false;
const login = async () => {
  let acc = Math.round(Math.random() * lnmtlAccounts.length);
  let account = lnmtlAccounts[acc];
  let resp = await fetchcookieRedirect("https://lnmtl.com/auth/login");
  let loginPage = await resp.text();
  const preCookie = parseCookies(resp);
  console.log("preCookie: " + preCookie);
  const $loginPage = cheerio.load(loginPage);
  const loginToken = $loginPage("meta#token").attr("value");
  let options = {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "en-US,en;q=0.9,te;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    referrer: "https://lnmtl.com/auth/login",
    referrerPolicy: "no-referrer-when-downgrade",
    body: `_token=${loginToken}&email=${account.email.replace(
      "@",
      "%40"
    )}&password=${account.password}`,
    method: "POST",
    mode: "cors",
  };
  let login = await fetchcookieRedirect(
    "https://lnmtl.com/auth/login",
    options
  );
  // console.log(login);
  // console.log(login.headers);
  if (login.status !== 302 && login.status !== 200) {
    console.log("login failed: " + login.status);
  }
  let postCookie = parseCookies(login, preCookie.split(";")[0]);
  console.log("after login: ");
  console.log("postCookie: " + postCookie);
  let home = login;
  let page = await home.text();
  const $ = cheerio.load(page);
  console.log(
    "Profile login check: " +
      $(
        "div#navbar > ul.nav.navbar-nav.navbar-right > li.dropdown > ul > li:nth-child(1)"
      ).text()
  );
  if (
    $(
      "div#navbar > ul.nav.navbar-nav.navbar-right > li.dropdown > ul > li:nth-child(1)"
    )
      .text()
      .includes("Profile")
  ) {
    isLoggedIn = true;
  }
  console.log(
    "Profile logout  check: " +
      $(
        "div#navbar > ul.nav.navbar-nav.navbar-right > li.dropdown.visible-md.visible-sm > ul > li:nth-child(1) > a"
      ).text()
  );
  return postCookie;
};

module.exports = {
  name: "lnmtl",
  description:
    "Scrape chapters from the given link for the specified N number of chapters!",
  usage: `${prefix}lnmtl <link> *N`,
  example: `${prefix}lnmtl \`https://lnmtl.com/chapter/douluo-dalu-4-final-douluo-chapter-1\` 60`,
  args: false,
  guildOnly: false,
  async execute(message, args) {
    let chapterCount = 0;
    let bookContent = [];
    let link = args[0];
    let linkMetadata = {};
    let isLoginCalled = false;
    if (!link.includes("lnmtl.com")) {
      return message.reply(`\`lnmtl\` command only supports lnmtl.com novels.`);
    }
    linkMetadata = await lnmtlScrapeMetadata(link);

    let maxChapters = _.isNaN(args[1]) ? null : args[1];
    let nextChapterExists = true;
    let processingMessage;

    let bookTitle = linkMetadata.title;
    let bookAuthor = linkMetadata.authors;
    let bookCoverArt = linkMetadata.image;
    // return;
    let customCss =
      "h1,h2,h3,h4,h5,h6,b,strong{color:#cc5635;font-style:italic;padding:0;margin:0}p,li{text-align:justify;text-indent:3%}br{text-align:justify;text-indent:3%}div{text-align:justify;text-indent:3%}";
    let cancelProcess = false;
    let numTries = 1;

    let cookieNum = 0;
    let requestCookie, responseCookie, cfduid;

    while (nextChapterExists) {
      try {
        numTries == 9 ? (isLoggedIn = false) : null;
        if (numTries >= 10) break;
        if (cookieNum > 3) {
          return;
        }
        isLoggedIn ? null : (requestCookie = await login(2));
        cfduid = requestCookie.split(";")[0].trim();
        console.log("processing :" + link);

        let response = await fetchcookieRedirect(
          link,
          getGetOptions(requestCookie)
        );
        // return;
        responseCookie = parseCookies(response, cfduid);
        requestCookie = responseCookie;
        console.log(response);
        let page = await response.text();
        // console.log(page);
        let warningText = "Chapter visible only for logged in users of lnmtl";
        if (response.status !== 200 || page.includes(warningText)) {
          console.log("invalid contents! response: " + response.status);
          cookieNum++;
          requestCookie = null;
          continue;
        }
        const $ = cheerio.load(page);
        let chapterContent = "";
        let chapterName = $("h3.dashhead-title > span.chapter-title")
          .text()
          .replace("#", "Chapter - ");
        $("div.chapter-body.hyphenate > sentence.original").remove();
        $("div.chapter-body.hyphenate > sentence.translated").each(function (
          i,
          el
        ) {
          let text = $(this).text().replace("„", "“");
          $(this).replaceWith(`<p>${text.trim()}</p>`);
        });
        chapterContent = "<hr/>" + $("div.chapter-body.hyphenate").html();
        console.log(chapterContent);
        // return;

        if (!chapterName) {
          let tempname = link.replace("https://lnmtl.com/chapter/", "");
          chapterName = _s.capitalize(
            tempname.substring(link.indexOf(/chapter-\d+/g))
          );
        }
        if (!chapterContent) {
          chapterContent =
            "<hr/>" + $("div.reading-content > div.text-left").html();
        }

        const nextChapterLink = $("div#topNav > nav > ul > li.next > a")
          .first()
          .attr("href");
        console.log(nextChapterLink);
        // return;
        link = nextChapterLink;
        nextChapterLink
          ? (nextChapterExists = true)
          : (nextChapterExists = false);
        console.log("Next chpater exists: " + nextChapterExists);
        if (chapterName && chapterContent) {
          bookContent.push({
            title: chapterName,
            data: chapterContent,
          });
        } else {
          console.log("skipping current chapter");
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
        if (chapterCount >= maxChapters) {
          break;
        }
      } catch (error) {
        console.log(error.message);
        console.log(`trying to load ${link} again`);
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
      publisher: "LNMTL", // optional
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
  },
};
