const axios = require("axios");
const reader = require("xlsx");
const file = reader.readFile("./18_7_goodTransactions.xlsx");
const { Base64 } = require("js-base64");

const api1 = axios.create({
  baseURL: "https://api.elrond.com",
  headers: {
    "Content-type": "application/json",
    Accept: "application/json",
  },
});

const getData = async () => {
  try {
    let res = await api1.get(
      `/accounts/erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8/transfers?from=0&size=6000`
    );
    console.log(res.data.length);
    await smartContractResults1(res.data);
  } catch (err) {
    console.log(err);
  }
};

const apiCall = async (hash) => {
  let i = 0;
  while (i < 20) {
    try {
      let res = await axios.get(`https://api.elrond.com/transaction/${hash}?withResults=true`);
      if (res.data) {
        console.log(i);
        return res;
      }
      i++;
    } catch {
      i++;
      continue;
    }
  }
};

const smartContractResults1 = async (dataArray) => {
  console.log(dataArray.length);
  try {
    let data = [];
    let failedData = [];
    let royal = 0
    for await (const item of dataArray) {
      const hashToCall = item.originalTxHash ? item.originalTxHash : item.txHash;

      const existInData = data.filter((item) => item.mainHash === hashToCall);

      if (existInData[0]) {
        console.log("exists!!!", existInData[0].mainHash);
        continue;
      }

      let resData = await apiCall(hashToCall);
      // console.log(resData)

      if (resData === "got failed") {
        console.log("failed", hashToCall);
        failedData.push(hashToCall);
        continue;
      }
      if (resData.data.data.transaction.value == 0) {
        console.log("value is zero:", hashToCall);
        continue;
      }
      if (!resData.data.data.transaction.smartContractResults) {
        console.log("there is no smartContractResults :", hashToCall);
        continue;
      }

      const logs = resData.data.data.transaction.logs;
      const smartContractResults = resData.data.data.transaction.smartContractResults;
      const mainHashValue = resData.data.data.transaction.value;

      const collection = logs.events[0].topics[0];
      const collectionName = Base64.decode(collection);

      console.log(hashToCall);

      const isValidSmartContractResults = smartContractResults.find(
        (el) => Object.keys(el).indexOf("returnMessage") === 11 && el.returnMessage === "sending value to non payable contract"
      );
      if (isValidSmartContractResults) continue;

      for (let i = 0; i < smartContractResults.length; i++) {
        if (
          smartContractResults[i].receiver ===
          "erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8" &&
          smartContractResults[i].returnMessage !== "sending value to non payable contract"
        ) {
          const internalHashValue = smartContractResults[i].value;

          const tenPercentOfMainValue = (mainHashValue / 100) * 10;

          const isAroyaltyHash = internalHashValue == tenPercentOfMainValue ? true : false;

          if (isAroyaltyHash) {
            // const nftName = (await scrape(hashToCall)) || "not found";

            const newobj = {
              royaltyValue: internalHashValue / 1000000000000000000,
              mainValue: mainHashValue / 1000000000000000000,
              internalHash: smartContractResults[i].hash,
              mainHash: hashToCall,
              collectionName: collectionName,
            };
            royal = royal + (internalHashValue / 1000000000000000000);
            data.push(newobj);
            console.log(newobj);
          }
        }
      }
    }
    console.log("data____________", data);
    console.log(failedData.length);
    console.log(royal)
    const ws = reader.utils.json_to_sheet(data);
    reader.utils.book_append_sheet(file, ws, "Sheet101");
    reader.writeFile(file, "./18_7_goodTransactions.xlsx");
  } catch (err) {
    console.log(err.message);
  }
};
getData();

// const scrape = async (hash) => {
//   try {
//     ``;
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto(`https://explorer.elrond.com/transactions/${hash}`);
//     await page.waitForSelector(".tab-content");
//     const newwholePage = await page.evaluate(
//       () => document.querySelector(".tab-content").innerHTML
//     );
//     const $ = await cheerio.load(newwholePage, null, false);
//     const listItems = $("a");
//     const arr = [];
//     listItems.each(function (idx, el) {
//       const name = $(el).children("div").children("span").text();
//       if (name) {
//         arr.push(name);
//       }
//     });
//     return arr[0];
//   } catch (err) {
//     return;
//   }
// };
