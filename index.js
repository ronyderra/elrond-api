const axios = require("axios");
const axiosRetry = require("axios-retry");
// import { TransactionDecoder, TransactionMetadata } from "@elrondnetwork/transaction-decoder";
// import { Base64 } from "js-base64";
// const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const reader = require("xlsx");
const file = reader.readFile("./elrond.xlsx");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

// import { ProxyNetworkProvider } from "@elrondnetwork/erdjs-network-providers";

// const csvWriter = createCsvWriter.createArrayCsvWriter({
//   path: "./transactions.csv",
//   header: [
//     { id: "value", title: "Value" },
//     { id: "receiver", title: "Receiver" },
//     { id: "sender", title: "Sender" },
//     { id: "error", title: "Error" },
//     { id: "hash", title: "Hash" },
//     { id: "originalSender", title: "OriginalSender" },
//     { id: "timestamp", title: "Timestamp" },
//   ],
// });

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
      let resData = await axios
        .get(`https://api.elrond.com/transaction/${item.txHash}?withResults=true`)
        .catch((e) => "got failed");

      if (resData === "got failed") {
        continue;
      }

      //   const smartContractResults = resData.data.data.transaction.smartContractResults
      //     ? resData.data.data.transaction.smartContractResults
      //     : undefined;
      //   console.log(smartContractResults);
      //   console.log(typeof(smartContractResults))

      if (resData.data.data.transaction.returnMessage === "sending value to non payable contract") {
        console.log("hash:" , item.txHash)
        console.log(resData.data.data.transaction.originalTransactionHash);

        if (!resData.data.data.transaction.originalTransactionHash) {
          const newobj = {
            value: resData.data.data.transaction.value,
            receiver: resData.data.data.transaction.receiver,
            sender: resData.data.data.transaction.sender,
            error: "sending value to non payable contract",
            hash: item.txHash,
            originalSender: resData.data.data.transaction.originalSender,
            originalTransactionHash: "not found",
            nftName : "not found" ,
          };
          data.push(newobj);
          console.log("_----------------notFound------" , item.txHash)
          continue;
        }

        const nftName = await scrape(resData.data.data.transaction.originalTransactionHash)  || "not found"  ;

        const newobj = {
          value: resData.data.data.transaction.value,
          receiver: resData.data.data.transaction.receiver,
          sender: resData.data.data.transaction.sender,
          error: "sending value to non payable contract",
          hash: item.txHash,
          originalSender: resData.data.data.transaction.originalSender,
          originalTransactionHash:resData.data.data.transaction.originalTransactionHash,
          nftName ,
        };
        console.log(newobj);
        data.push(newobj);
        continue;
      }

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
    }
    console.log("data____________", data);

    const ws = reader.utils.json_to_sheet(data);
    // console.log(ws)
    reader.utils.book_append_sheet(file, ws, "Sheet30");
    reader.writeFile(file, "./elrond.xlsx");
  } catch (err) {
    console.log(err.message);
  }
};

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
        console.log(name);
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
