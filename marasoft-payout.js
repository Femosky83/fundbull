const https = require("https");
const crypto = require("crypto");

const LIVE_KEY = "MSFT_live_QE6QTSGTRUX6JJUMD4JKXWMQLXX0VFE";
const ENC_KEY = "MSFT_Enc_TL7QWDNDVKLIHMATWAUGDC6G4K2SAIF";

function encrypt(data) {
  const key = crypto.scryptSync(ENC_KEY, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { accountNumber, bankCode, accountName, amount, narration } = JSON.parse(event.body || "{}");

  const transferData = {
    live_key: LIVE_KEY,
    account_number: accountNumber,
    bank_code: bankCode,
    account_name: accountName,
    amount: amount,
    narration: narration || "FundBull Withdrawal"
  };

  const encryptedPayload = encrypt(transferData);

  const payload = JSON.stringify({ data: encryptedPayload });

  return new Promise((resolve) => {
    const options = {
      hostname: "marasoft.ng",
      path: "/api/v1/transfer",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${LIVE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: data
        });
      });
    });

    req.on("error", (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
