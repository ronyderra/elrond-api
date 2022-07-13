const axios = require("axios");
const axiosRetry = require("axios-retry");
const reader = require("xlsx");
const file = reader.readFile("./10_7_badTransactions.xlsx");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
// var BigNumber = require("big-number");
const { ethers, BigNumber } = require("ethers");

axiosRetry(axios, {
  retries: 3, // number of retries
  retryDelay: (retryCount) => {
    console.log(`retry attempt: ${retryCount}`);
    return retryCount * 2000; // time interval between retries
  },
  retryCondition: (error) => {
    // if retry condition is not specified, by default idempotent requests are retried
    return error.response.status === 503;
  },
});

const api1 = axios.create({
  baseURL: "https://api.elrond.com",
  headers: {
    "Content-type": "application/json",
    Accept: "application/json",
  },
});

const api = axios.create({
  baseURL: "https://api.elrond.com",
  headers: {
    "Content-type": "application/json",
    Accept: "application/json",
  },
});

const getData = async () => {
  try {
    let res = await api1.get(
      `/accounts/erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8/transfers?from=0&size=4100`
    );
    console.log(res.data.length);
    await smartContractResults1(res.data);
  } catch (err) {
    console.log(err);
  }
};

/**
 * Promise.allSets(dataArray.map(async (item) => {
 *    return axios
 * }))
 * @param {
 *
 * } dataArray
 */
const smartContractResults1 = async (dataArray) => {
  console.log(dataArray.length);
  try {
    let data = [];
    for await (const item of dataArray) {
      const hashToCall = item.originalTxHash ? item.originalTxHash : item.txHash;

      let existInData = false;

      for (let z = 0; z < data.length; z++) {
        const hashInArray = data[z].mainHash;
        if (hashInArray === hashToCall) {
          console.log("exists!!!", hashToCall);
          existInData = true;
          break;
        }
      }

      if (existInData) {
        continue;
      }

      let resData = await axios
        .get(`https://api.elrond.com/transaction/${hashToCall}?withResults=true`)
        .catch((e) => "got failed");

      if (resData === "got failed") {
        console.log("failed", hashToCall);
        continue;
      }
      if (resData.data.data.transaction.value == 0) {
        console.log("value is zero:", hashToCall);
        continue;
      }
      if (!resData.data.data.transaction.smartContractResults) {
        console.log("there is no smartContractResults :",hashToCall);
        continue;
      }

      const smartContractResults = resData.data.data.transaction.smartContractResults;
      const mainHashValue = resData.data.data.transaction.value;

      console.log(hashToCall);
 
      let isValidSmartContractResults = false;

      for (let t = 0; t < smartContractResults.length; t++) {
        if (Object.keys(smartContractResults[t]).indexOf("returnMessage") === 11) {
          console.log("returnMessage:" + " " + smartContractResults[t].returnMessage + " " +  smartContractResults[t].hash);
          isValidSmartContractResults = true;
          break;
        }
      }

      if (isValidSmartContractResults) {
        for (let i = 0; i < smartContractResults.length; i++) {
         
          if (
            // smartContractResults[i].receiver ===
            // "erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8" &&
            smartContractResults[i].returnMessage === "sending value to non payable contract"
          ) {
            const internalHashValue = smartContractResults[i].value;

            const tenPercentOfMainValue = (mainHashValue / 100) * 10;

            const isAroyaltyHash = internalHashValue == tenPercentOfMainValue ? true : false;

            if (isAroyaltyHash) {
              const nftName = (await scrape(hashToCall)) || "not found";

              const newobj = {
                royaltyValue: internalHashValue/1000000000000000000,
                mainValue: mainHashValue/1000000000000000000,
                internalHash: smartContractResults[i].hash,
                mainHash: hashToCall,
                nftName,
              };
              data.push(newobj);
              console.log(newobj);
            }
          }
        }
      }
    }
    console.log("data____________", data);
    const ws = reader.utils.json_to_sheet(data);
    reader.utils.book_append_sheet(file, ws, "Sheet101");
    reader.writeFile(file, "./10_7_badTransactions.xlsx");
  } catch (err) {
    console.log(err.message);
  }
};

const scrape = async (hash) => {
  try {``
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`https://explorer.elrond.com/transactions/${hash}`);
    await page.waitForSelector(".tab-content");
    const newwholePage = await page.evaluate(
      () => document.querySelector(".tab-content").innerHTML
    );
    const $ = await cheerio.load(newwholePage, null, false);
    const listItems = $("a");
    const arr = [];
    listItems.each(function (idx, el) {
      const name = $(el).children("div").children("span").text();
      if (name) {
        arr.push(name);
      }
    });
    return arr[0];
  } catch (err) {
    return;
  }
};

(async () => {
  const res = await getData();
})();


