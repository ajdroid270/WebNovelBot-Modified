const FormData = require("form-data");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const { prefix, shrinkmeToken } = process.env;
const urlMetadata = require("url-metadata");
const { google } = require("googleapis");
const credentials = JSON.parse(process.env.serviceAccCreds);
let driveFiles = require("./drive-files.json");
const lnmtlAccounts = JSON.parse(process.env.miscData);
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const jsdom = require("jsdom");
const cookies = JSON.parse(process.env.cookies);
const { JSDOM } = jsdom;
const fuzzysort = require('fuzzysort')
const Discord = require('discord.js');
const Pagination = require('discord-paginationembed');
const paginationEmbed = require('discord.js-pagination');


const scopes = JSON.parse(process.env.scopes);
const ORIGINAL_PERMISSION_ID = process.env.ORIGINAL_PERMISSION_ID;
const ORIGINAL_EMAIL_ADDRESS = process.env.ORIGINAL_EMAIL_ADDRESS;
const SERVICE_ACCOUNT_PERMISSION_ID = process.env.SERVICE_ACCOUNT_PERMISSION_ID;
const PUBLIC = "anyoneWithLink";

let auth;
try {
  auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    scopes,
    null,
    credentials.private_key_id
  );
} catch (error) {
  console.log(error.message);
}

const drive = google.drive({ version: "v3", auth });

const driveTmpFolderId = process.env.driveTmpFolderId;

const getDrives = async () => {
  let allDataFetched = false;
  let nextPageToken = null;
  let drives = [];
  try {
    do {
      let res = await drive.files.list({
        orderBy: "name",
        pageSize: 999,
        q: "mimeType = 'application/epub+zip'",
        pageToken: nextPageToken,
        useDomainAdminAccess: false,
      });
      drives.push(...res.data.files);
      //   console.log(res);
      console.log(res.data.nextPageToken);
      nextPageToken = res.data.nextPageToken;
      if (!res.data.nextPageToken) {
        allDataFetched = true;
      }
    } while (!allDataFetched);
    console.log(drives);
  } catch (error) {
    console.error(error);
  }
};

const updateDriveFiles = async (jsonData = null) => {
  let allDataFetched = false;
  let nextPageToken = null;
  let files = [];
  let drives = [];
  try {
    if (jsonData != null) {
      files = jsonData;
    } else {
      do {
        let res = await drive.files.list({
          fields:
            "nextPageToken, files(name, id, mimeType, webContentLink, webViewLink, size, md5Checksum, modifiedTime, ownedByMe)",
          orderBy: "name",
          pageSize: 999,
          pageToken: nextPageToken,
          q: "mimeType='application/epub+zip'",
        });
        files.push(...res.data.files);
        console.log(res);
        console.log(res.data.nextPageToken);
        nextPageToken = res.data.nextPageToken;
        if (!res.data.nextPageToken) {
          allDataFetched = true;
        }
        fs.writeFileSync("./drive-files.json", JSON.stringify(files), "utf8");
      } while (!allDataFetched);
    }

    // const files = res.data.files.filter((file) => {
    //     return file.name == name;
    // });

    // console.log(files);
    driveFiles = files;

    fs.writeFileSync("./drive-files.json", JSON.stringify(files), "utf8");
    console.log("writing finished");
    return true;
  } catch (error) {
    console.log(error.message);
  }
};

const uploadFileToDrive = async (filePath, drivePath, fileName) => {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [drivePath],
    };
    const media = {
      mimeType: "application/epub+zip",
      body: fs.createReadStream(filePath),
    };
    let file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "*",
    });
    // console.log(file.data);
    /* let newFile = await drive.permissions.update({
            fileId: file.data.id,
            fields: '*',
            permissionId: SERVICE_ACCOUNT_PERMISSION_ID,
            transferOwnership: true,
            resource: {
                role: 'owner'
            }
        });
        file.data.permissions.push(newFile.data) */
    driveFiles.push(file.data);
    updateDriveFiles(driveFiles);
    console.log(`Uploading ${filePath} to ${drivePath}`);
    return file.data;
  } catch (error) {
    console.log(error.message);
  }
};

const deleteDriveFile = async (name) => {
  const res = await drive.files.list({
    fields: "files(*)",
    orderBy: "name_natural",
  });

  const files = res.data.files;
  let filteredFiles;
  let remainingFiles;

  if (name === "bot") {
    filteredFiles = files.filter((file) => {
      return file.ownedByMe;
    });
    remainingFiles = files.filter((file) => {
      return !file.ownedByMe;
    });
  } else {
    filteredFiles = files.filter((file) => {
      return file.name == name;
    });
    remainingFiles = files.filter((file) => {
      return !(file.name == name);
    });
  }

  console.log(filteredFiles);

  for (file of filteredFiles) {
    drive.files
      .delete({
        fileId: file.id,
        fields: "id, parents",
      })
      .then((res) => {
        console.log(res);
      });
  }
  updateDriveFiles(remainingFiles);
};


const matchWords = (subject, words) => {
  var regexMetachars = "/[(){[*+?.\\^$|]/g";

  for (var i = 0; i < words.length; i++) {
    words[i] = words[i].replace(regexMetachars, "\\$&");
  }

  var regex = new RegExp("\\b(?:" + words.join("|") + ")\\b", "gi");

  return subject.match(regex) || [];
};

const searchDriveFiles = (searchString) => {
  return fuzzysort.go(searchString, driveFiles, {key:'name'});
}

// const paginateData = async (data, message) => {
//   const embeds = [];

//   for (let i = 1; i <= 5; ++i){
//     embeds.push(new Discord.MessageEmbed().addField('Page', i));
//   }

//   const Embeds = new Pagination.Embeds()
//     .setArray(embeds)
//     .setAuthorizedUsers([message.author.id])
//     .setChannel(message.channel)
//     .setPageIndicator(true)
//     .setTitle('Test Title')
//     .setDescription('Test Description')
//     .setFooter('Test Footer Text')
//     .setURL('https://gazmull.github.io/discord-paginationembed')
//     .setColor(0xFF00AE)
//     // Sets the client's assets to utilise. Available options:
//     //  - message: the client's Message object (edits the message instead of sending new one for this instance)
//     //  - prompt: custom content for the message sent when prompted to jump to a page
//     //      {{user}} is the placeholder for the user mention
//     .setClientAssets({ message, prompt: 'Page plz {{user}}' })
//     .setDeleteOnTimeout(true)
//     .setDisabledNavigationEmojis(['delete'])
//     .setFunctionEmojis({
//       '⬆': (_, instance) => {
//         for (const embed of instance.array)
//           embed.fields[0].value++;
//       },
//       '⬇': (_, instance) => {
//         for (const embed of instance.array)
//           embed.fields[0].value--;
//       }
//     })
//     // Listeners for PaginationEmbed's events
//     // After the initial embed has been sent
//     // (technically, after the client finished reacting with enabled navigation and function emojis).
//     .on('start', () => console.log('Started!'))
//     // When the instance is finished by a user reacting with `delete` navigation emoji
//     // or a function emoji that throws non-Error type.
//     .on('finish', (user) => console.log(`Finished! User: ${user.username}`))
//     // Upon a user reacting on the instance.
//     .on('react', (user, emoji) => console.log(`Reacted! User: ${user.username} | Emoji: ${emoji.name} (${emoji.id})`))
//     // When the awaiting timeout is reached.
//     .on('expire', () => console.warn('Expired!'))
//     // Upon an occurance of error (e.g: Discord API Error).
//     .on('error', console.error);

//   return Embeds.build();
// }

const paginateData = async (data, message, options={pageLength: 10, searchString}) => {
  const numPages = Math.ceil(data.length/options.pageLength);
  const renderEmbed = (page, totalPages, list) => {
    const fields = [];
    for(let i = 0; i< list.length; i++){
      const item = list[i];
      item.obj.size / (1024 * 1024) < 0.25
    ? (item.obj.relSize = `${(item.obj.size / 1024).toFixed(2)} KB`)
    : (item.obj.relSize = `${(item.obj.size / (1024 * 1024)).toFixed(2)} MB`);
      fields.push({
        name: `Book ${(page-1)*options.pageLength+(i+1)}: ${item.obj.name}`,
        value: `Size: ${item.obj.relSize} | Last Modified: ${moment(item.obj.modifiedTime).format("LLLL")} | [Download Link](${shrinkifyUrl(item.obj.webContentLink)})`
        })
    }
    const embed = new Discord.MessageEmbed()
      .setColor('#0099ff')
      .setTitle(`Page ${page}`)
      .setAuthor('Webnovel Bot')
      .setDescription(`Search Results ${options.searchString && 'for ' + options.searchString}`)
      .addFields(fields)
      .setTimestamp()
    return embed;
  }
  let embeds = [];
  for(let i = 0; i<numPages; i++){
    embeds.push(renderEmbed(i+1, numPages, data.slice(i*options.pageLength, (i+1)*options.pageLength)));
  }
  console.log(embeds, numPages);
  return paginationEmbed(message, embeds);
}

const addUrlParam = (baseUrl, key, value) => {
  isFirstParam = !baseUrl.includes('?');
  return `${baseUrl}${isFirstParam ? '?':'&'}${key}=${value}`
}

const shrinkifyUrl = (url, alias, ads = true, quick = true) => {
  let baseUrl = quick ? `https://shrinkme.io/st`: `https://shrinkme.io/api`;
  let myUrl = addUrlParam(baseUrl, 'api', shrinkmeToken);
  myUrl = addUrlParam(myUrl, 'url', url);
  if(alias) myUrl = addUrlParam(myUrl, 'alias', alias.substring(0,30));
  if (!ads) {
    myUrl = addUrlParam(myUrl, 'type', 0);
    // baseurl += "&type=0";
  }
  console.log(myUrl);
  return myUrl;
}

const shrinkMe = async (url, alias, ads = true) => {
  let myUrl = shrinkifyUrl(url, alias, ads, false);
  return fetch(myUrl)
    .then((res) => res.json())
    .then((result) => {
      console.log(result);
      return result.shortenedUrl;
    });
};

const getDriveEmbed = async (obj, ads = true) => {
  obj.size / (1024 * 1024) < 0.25
    ? (obj.relSize = `${(obj.size / 1024).toFixed(2)} KB`)
    : (obj.relSize = `${(obj.size / (1024 * 1024)).toFixed(2)} MB`);
  obj.shortName = obj.name
    .split(" ")
    .join("_")
    .replace(".epub", "")
    .replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "");
  console.log("Short Name: ", obj.shortName);
  console.log("Download Link: ", obj.webContentLink);
  if (ads) {
    obj.shortUrl = await shrinkMe(obj.webContentLink, obj.shortName, ads);
  } else {
    obj.shortUrl = obj.webContentLink;
  }
  console.log(obj.shortUrl);
  return {
    content: "",
    embed: {
      title: obj.name,
      url: obj.shortUrl,
      color: 4888244,
      fields: [
        {
          name: "Size",
          value: obj.relSize,
        },
        {
          name: "MD5 Checksum",
          value: `${obj.md5Checksum}`,
        },
        {
          name: "Last Modified",
          value: `${moment(obj.modifiedTime).format("LLLL")}`,
        },
      ],
    },
  };
};

async function nuSearchShort(searchString, metadataBool, regExp = true) {
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
  for (var i = 0; i < elements.length; i++) {
    el = elements[i];
    const link = el.attribs.href;
    let regex = RegExp(searchString.split("").join("[^>]*?", "gi"));
    let shortLink = link.replace("https://www.novelupdates.com/series/", "");
    if (regex.test(shortLink) || !regExp) {
      if (metadataBool) {
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
      } else {
        l.push(link);
      }
    }
  }
  end = Date.now();
  return l;
}

async function nuSearchLong(args, metadataBool, regExp = true) {
  console.time("Fetch novel data");
  args = args.split(" ");
  var result = await fetch(
    `https://www.novelupdates.com/?s=${args.join("+")}&post_type=seriesplans`
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
    let shortLink = link.replace("https://www.novelupdates.com/series/", "");
    if (regex.test(shortLink)) {
      if (metadataBool) {
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
      } else {
        l.push(link);
      }
    }
    console.timeEnd("new loop");
  }
  console.timeEnd("loop novels");
  end = Date.now();
  return l;
}

const lnmtlScrapeMetadata = async (ogLink) => {
  let result1 = await fetch(ogLink).then((res) => res.text());
  const $1 = cheerio.load(result1);
  link = $1("div.dashhead-titles > h6 > a").attr("href");
  let result = await fetch(link).then((res) => res.text());
  // console.log(result);
  const $ = cheerio.load(result);
  let metadata = {};
  metadata.title = $("meta[property='og:title']")
    .attr("content")
    .replace(" - ", "-")
    .trim();
  metadata.description = $("meta[property='og:description']").attr("content");
  metadata.image = $("meta[property='og:image:url']").attr("content");
  metadata.authors = [
    $(
      "div.panel-body > dl:nth-child(1) > dd > span.label.label-default"
    ).text(),
  ];
  metadata.genre = [];
  metadata.tags = [];
  console.log(metadata);
  return metadata;
};

const parseCookies = (response, cfduid = null) => {
  const raw = response.headers.raw()["set-cookie"];
  let cookie = raw
    .map((entry) => {
      const parts = entry.split(";");
      const cookiePart = parts[0];
      return cookiePart;
    })
    .join(";");
  if (cfduid != null) {
    cookie = `${cfduid};${cookie}`;
  }
  // console.log(cookie);
  return cookie;
};

const getGetOptions = (cookie) => {
  let options = {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "en-US,en;q=0.9,te;q=0.8",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      cookie: cookie,
    },
    referrer: "https://lnmtl.com/auth/login",
    referrerPolicy: "no-referrer-when-downgrade",
    body: null,
    method: "GET",
    mode: "cors",
  };
  return options;
};
const lnmtlLogin = async (acc = 0) => {
  let loggedIn = false;
  do {
    let account = lnmtlAccounts[acc];
    console.log(account);
    let resp = await fetch("https://lnmtl.com/auth/login");
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
        cookie: `${preCookie}`,
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
    let login = await fetch("https://lnmtl.com/auth/login", options);
    console.log(login);
    console.log(login.headers);
    if (login.status !== 302 && login.status !== 200) {
      console.log("login failed: " + login.status);
      acc++;
      continue;
    }
    let postCookie = parseCookies(login, preCookie.split(";")[0]);
    console.log("after login: ");
    console.log("postCookie: " + postCookie);
    let home = login;
    // let home = await fetch('https://lnmtl.com/', getGetOptions(postCookie));
    // postCookie = parseCookies(home, preCookie.split(';')[0]);
    let page = await home.text();
    const $ = cheerio.load(page);
    console.log(
      "Profile login check: " +
        $(
          "div#navbar > ul.nav.navbar-nav.navbar-right > li.dropdown.open > ul > li:nth-child(1)"
        ).text()
    );
    console.log(
      "Profile logout  check: " +
        $(
          "div#navbar > ul.nav.navbar-nav.navbar-right > li.dropdown.visible-md.visible-sm > ul > li:nth-child(1) > a"
        ).text()
    );
    cookies[`lnmtl_${acc}`] = postCookie;
    // fs.writeFileSync(path.resolve(process.cwd(), './cookies.json'), cookies, 'utf8');
    return postCookie;
  } while (acc < 4);
};

async function nuScrapeMetadata(link) {
  console.log(link);
  var result = await fetch(link)
    .then((res) => res.text())
    .catch((err) => console.log(err.message));
  const $ = cheerio.load(result);
  let metadata = {};
  metadata.title = $("div.seriestitlenu").text();
  metadata.image = $("meta[property='og:image']").attr("content");
  metadata.description = $("div#editdescription").text();
  metadata.rating = "Rating: " + $("h5.seriesother>span.uvotes").text();
  metadata.authors = [];
  metadata.genre = [];
  metadata.tags = [];
  $("div#showauthors>a").each((i, el) => {
    metadata.authors.push(el.children[0].data);
  });

  $("div#seriesgenre>a.genre").each((i, el) => {
    metadata.genre.push(el.children[0].data);
  });

  $("div#showtags>a.genre").each((i, el) => {
    metadata.tags.push(el.children[0].data);
  });

  // console.log(metadata);
  return metadata;
}

async function boxScrapeMetadata(link) {
  var result = await fetch(link)
    .then((res) => res.text())
    .catch((err) => console.log(err.message));
  const $ = cheerio.load(result);
  let metadata = {};
  metadata.title = $("div.seriestitlenu").text();
  metadata.image = $("meta[property='og:image']").attr("content");
  metadata.description = $("div#editdescription").text();
  metadata.rating = "Rating: " + $("h5.seriesother>span.uvotes").text();
  metadata.authors = [];
  metadata.genre = [];
  metadata.tags = [];
  $("div#showauthors>a").each((i, el) => {
    metadata.authors.push(el.children[0].data);
  });

  $("div#seriesgenre>a.genre").each((i, el) => {
    metadata.genre.push(el.children[0].data);
  });

  $("div#showtags>a.genre").each((i, el) => {
    metadata.tags.push(el.children[0].data);
  });

  // console.log(metadata);
  return metadata;
}

async function wwcoScrapeMetadata(link) {
  link = link.split("/");
  link.pop();
  const novelLink = link.join("/") + "/";
  console.log(novelLink);
  var result = await fetch(novelLink)
    .then((res) => res.text())
    .catch((err) => console.log(err.message));
  const $ = cheerio.load(result);
  let metadata = {};
  metadata.title = $(
    " div.book-container > div.book-wrapper > div.book-info > div.book-name"
  ).text();
  metadata.image = $(
    "div.book-container > div.book-wrapper > div.book-img > img"
  ).attr("src");
  metadata.description = $(
    "#detail > div.about-wrapper > div.synopsis > div.content > p.desc"
  ).text();
  metadata.rating =
    "Rating: " +
    $(
      "div.book-container > div.book-wrapper > div.book-info > div.star-suite.clearfix > span.score"
    ).text();
  metadata.authors = [
    $(
      "div.book-container > div.book-wrapper > div.book-info > div.person-info > div.author > span.name"
    ).text(),
  ];
  metadata.genre = [
    $(
      "div.book-container > div.book-wrapper > div.book-info > div.base-info > div.book-catalog > span.txt"
    ).text(),
  ];
  metadata.tags = [
    $(
      "div.book-container > div.book-wrapper > div.book-info > div.base-info > div.book-state > span.txt"
    ).text(),
  ];
  console.log(metadata);
  return metadata;
}

async function mtlnScrapeMetadata(link) {
  link = link.split("/");
  let removed = link.pop();
  removed == "" ? link.pop() : null;
  const novelLink = link.join("/") + "/";
  console.log("NovelLink: " + novelLink);
  var result = await fetch(novelLink)
    .then((res) => res.text())
    .catch((err) => console.log(err.message));
  const $ = cheerio.load(result);
  let metadata = {};
  metadata.title = $("div.m-card.single-page > h1.entry-title").text();
  metadata.image = $(
    "body > main > article > div.m-card.single-page > div.post-content > div > amp-img > amp-img"
  ).attr("src");
  metadata.description = $("div#panelnovelinfo > div.desc").text();
  metadata.rating =
    "Rating: " +
    $(
      "div.m-card.single-page > div.post-content > div.nov-head> div.ratings > span.rating-info > strong"
    ).text();
  metadata.authors = [
    $(
      "#panelnovelinfo > table > tbody > tr:nth-child(4) > td:nth-child(3) > a"
    ).text(),
  ];
  metadata.genre = [
    $(
      "#panelnovelinfo > table > tbody > tr:nth-child(7) > td:nth-child(3) > a"
    ).text(),
  ];
  metadata.tags = $(
    "#panelnovelinfo > table > tbody > tr:nth-child(11) > td:nth-child(3)"
  )
    .text()
    .split(",");
  var result1 = await fetch(novelLink + "chapter-list/")
    .then((res) => res.text())
    .catch((err) => console.log(err.message));
  const $$ = cheerio.load(result1);
  metadata.chaptersList = [];
  $$(
    "body > main > article > div > div.post-content > div.ch-list a.ch-link"
  ).each(function (i, el) {
    metadata.chaptersList.push({
      chapLink: $$(this).attr("href"),
      chapTitle: $$(this).text(),
    });
  });
  metadata.chaptersList.reverse();
  return metadata;
}

const generateEpub = (data, options) => {

}

module.exports = {
  scopes: scopes,
  driveTmpFolder: driveTmpFolderId,
  searchDriveFiles,
  matchWords,
  getDrives,
  updateDriveFiles,
  uploadFileToDrive,
  deleteDriveFile,
  paginateData,
  lnmtlScrapeMetadata,
  lnmtlLogin,
  parseCookies,
  getGetOptions,
  nuSearchShort,
  nuSearchLong,
  nuScrapeMetadata,
  boxScrapeMetadata,
  wwcoScrapeMetadata,
  mtlnScrapeMetadata,
  shrinkMe,
  getDriveEmbed,
  generateEpub,
};
