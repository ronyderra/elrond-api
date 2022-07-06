const axios = require("axios");
const axiosRetry = require("axios-retry");
const reader = require("xlsx");
const file = reader.readFile("./newElrond.xlsx");
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
      `/accounts/erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8/transfers?from=0&size=4000`
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
 
      let isValidSmartContractResults = true;

      for (let t = 0; t < smartContractResults.length; t++) {
        if (Object.keys(smartContractResults[t]).indexOf("returnMessage") === 11) {
          console.log("returnMessage:" + " " + smartContractResults[t].returnMessage + " " +  smartContractResults[t].hash);
          isValidSmartContractResults = false;
          break;
        }
      }

      if (isValidSmartContractResults) {
        for (let i = 0; i < smartContractResults.length; i++) {
          if (
            smartContractResults[i].receiver ===
            "erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8"
          ) {
            const internalHashValue = smartContractResults[i].value;

            const tenPercentOfMainValue = (mainHashValue / 100) * 10;

            const isAroyaltyHash = internalHashValue == tenPercentOfMainValue ? true : false;

            if (isAroyaltyHash) {
              const nftName = (await scrape(hashToCall)) || "not found";

              const newobj = {
                royaltyValue: internalHashValue,
                mainValue: mainHashValue,
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

      // const royaltyTransaction = smartContractResults[smartContractResults.length - 1];
      // console.log(royaltyTransaction)

      // if (royaltyTransaction["returnMessage"] === undefined) {
      //   const nftName = (await scrape(item.txHash)) || "not found";
      //   const newobj = {
      //     valueEgld: royaltyTransaction.value,
      //     receiver: royaltyTransaction.receiver,
      //     sender: royaltyTransaction.sender,
      //     hash: royaltyTransaction.hash,
      //     originalTransactionHash: royaltyTransaction.originalTxHash,
      //     nftName,
      //   };
      //   data.push(newobj);
      // } else {
      //   continue;
      // }

      // if (resData.data.data.transaction.returnMessage !== "sending value to non payable contract") {
      //   if (!resData.data.data.transaction.originalTransactionHash) {
      //     const newobj = {
      //       valueEgld: resData.data.data.transaction.value,
      //       valueUSD: resData.data.data.transaction.value * 1e-20 * 50,
      //       receiver: resData.data.data.transaction.receiver,
      //       sender: resData.data.data.transaction.sender,
      //       // error: "sending value to non payable contract",
      //       hash: item.txHash,
      //       originalSender: resData.data.data.transaction.originalSender,
      //       originalTransactionHash: "not found",
      //       nftName: "not found",
      //     };
      //     data.push(newobj);
      //     continue;
      //   }

      //   const nftName =
      //     (await scrape(resData.data.data.transaction.originalTransactionHash)) || "not found";

      //   const newobj = {
      //     valueEgld: resData.data.data.transaction.value,
      //     valueUSD: resData.data.data.transaction.value * 1e-20 * 50,
      //     receiver: resData.data.data.transaction.receiver,
      //     sender: resData.data.data.transaction.sender,
      //     hash: item.txHash,
      //     originalSender: resData.data.data.transaction.originalSender,
      //     originalTransactionHash: resData.data.data.transaction.originalTransactionHash,
      //     nftName,
      //   };
      //   data.push(newobj);
      //   continue;
      // }
    }
    console.log("data____________", data);
    const ws = reader.utils.json_to_sheet(data);
    reader.utils.book_append_sheet(file, ws, "Sheet101");
    reader.writeFile(file, "./newElrond.xlsx");
  } catch (err) {
    console.log(err.message);
  }
};

const scrape = async (hash) => {
  try {
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

// import { TransactionDecoder, TransactionMetadata } from "@elrondnetwork/transaction-decoder";
// import { Base64 } from "js-base64";
// const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// const decode = async () => {
//   try {
//     let networkProvider = new ProxyNetworkProvider("https://gateway.elrond.com");

//     let transactionOnNetwork = await networkProvider.getTransaction(
//       "2ce4cf1425eb1dd8c2cddb21adbfbd7a2292be6fb9658187783c2b770ccb612c"
//     );

//     console.log(transactionOnNetwork)

//     // const b64Decode = Buffer.from(transactionOnNetwork.logs.events[0].topics[0].raw, "base64").toString("utf-8");
//     // console.log(b64Decode);

//     let metadata = new TransactionDecoder().getTransactionMetadata({
//       sender: transactionOnNetwork.sender.bech32(),
//       receiver: transactionOnNetwork.receiver.bech32(),
//       data: transactionOnNetwork.data.toString("base64"),
//       value: transactionOnNetwork.value.toString(),
//       type: transactionOnNetwork.type,
//     });
//     // console.log("metadata", metadata);
//     // console.log("metadata", Base64.atob(metadata.functionArgs[0]))
//     // console.log("metadata", Base64.decode(metadata.functionArgs[1]))
//     // console.log("metadata", Base64.decode(metadata.functionArgs[2]))
//     // console.log("metadata", Base64.decode(metadata.functionArgs[3]))
//     // console.log("metadata", Base64.decode(metadata.functionArgs[4]))
//     // console.log("metadata", Base64.decode(metadata.functionArgs[5]))
//   } catch (err) {
//     console.log(err.message);
//   }
// };

//   const smartContractResults = resData.data.data.transaction.smartContractResults
//     ? resData.data.data.transaction.smartContractResults
//     : undefined;
//   console.log(smartContractResults);
//   console.log(typeof(smartContractResults))

//   if (smartContractResults) {
//     // console.log(item.txHash, smartContractResults.length);
//     for (let i = 0; i < smartContractResults.length; i++) {
//       const k = smartContractResults[i];
//       if (
//         k["returnMessage"] !== undefined &&
//         k["returnMessage"] === "sending value to non payable contract"
//       ) {
//         const newobj = {
//           value: resData.data.data.transaction.value,
//           contractAddress: resData.data.data.transaction.logs.address,
//           error: "sending value to non payable contract",
//           hash: item.txHash,
//         };
//         console.log(newobj);
//         continue;
//       }
//     }
//   }
