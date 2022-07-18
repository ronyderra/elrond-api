const axios = require("axios");
const reader = require("xlsx");
const { Base64 } = require("js-base64");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
var cron = require("node-cron");
const token = "5285257815:AAE7Rzxj2U68im8HKGbjfgRkdmTMwyoPO4o";
const GROUP_ID = "-778913594";
const bot = new TelegramBot(token, { polling: true });

const api1 = axios.create({
  baseURL: "https://api.elrond.com",
  headers: {
    "Content-type": "application/json",
    Accept: "application/json",
  },
});

const getData = async (fileName) => {
  try {

console.log("got here")
    const file = reader.readFile("./" + fileName);

    let res = await api1.get(
      `/accounts/erd1qqqqqqqqqqqqqpgq3y98dyjdp72lwzvd35yt4f9ua2a3n70v0drsfycvu8/transfers?from=50&size=100`
    );
    console.log(res.data.length);
    await smartContractResults1(res.data, file, fileName);
  } catch (err) {
    console.log(err);
  }
};

const smartContractResults1 = async (dataArray, aFile, fileName) => {
  console.log(dataArray.length);
  try {
    let data = [];
    let royalties = 0;
    let index = 0;
    for await (const item of dataArray) {
      index++;
      console.log("index: ", index);
      const hashToCall = item.originalTxHash ? item.originalTxHash : item.txHash;

      const existInData = data.filter((item) => item.mainHash === hashToCall);

      if (existInData[0]) {
        console.log("exists!!!", existInData[0].mainHash);
        continue;
      }

      let resData = await transactionCall(hashToCall);

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
      console.log(collectionName);

      console.log("####hashToCall####:", hashToCall);

      const transactionFailed = smartContractResults.find(
        (el) =>
          Object.keys(el).indexOf("returnMessage") === 11 &&
          el.returnMessage === "sending value to non payable contract"
      );
      if (transactionFailed) {
        console.log("transaction Failed", hashToCall);
        continue;
      }

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
            const newobj = {
              royaltyValue: internalHashValue / 1000000000000000000,
              mainValue: mainHashValue / 1000000000000000000,
              internalHash: smartContractResults[i].hash,
              mainHash: hashToCall,
              collectionName: collectionName,
            };
            royalties += internalHashValue / 1000000000000000000;
            data.push(newobj);
            console.log(newobj);
          }
        }
      }
    }
    console.log("data____________", data);
    console.log("royalties:", royalties);

    const ws = reader.utils.json_to_sheet(data);
    reader.utils.book_append_sheet(aFile, ws);
    reader.writeFile(aFile, "./" + fileName);

    await bot
      .sendDocument(
        GROUP_ID,
        fs.readFileSync("./" + fileName),
        {
          caption: "total royalyies:" + royalties + " EGLD",
        },
        {
          filename: fileName,
          contentType:
            "application/application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      )
      .then(() => {
        console.log("File has been sent");
      });

  } catch (err) {
    console.log(err.message);
  }
};

cron.schedule("* * * * *",async () => {
  console.log("running a task every minute");
  const fileName =Date(Date.now())
 await openFile(fileName + ".xlsx")


 setTimeout( () =>{
   getData(fileName.toString() + ".xlsx");
}, 5000);
 
});

const openFile = (fileName) =>{
  fs.open(fileName.toString(), "w", function (err, file) {
    if (err) throw err;
    console.log("Saved!");
  });
}


const transactionCall = async (hash) => {
  let i = 0;
  while (i < 200) {
    try {
      let res = await axios.get(`https://api.elrond.com/transaction/${hash}?withResults=true`);
      if (res.data) {
        return res;
      }
      i++;
    } catch {
      i++;
      continue;
    }
  }
};
