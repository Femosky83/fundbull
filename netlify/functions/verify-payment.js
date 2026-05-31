const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { reference } = JSON.parse(event.body || "{}");

  const payload = JSON.stringify({
    public_key: "Bill_Stack-PUB-KEY-41d4cdc3947059ca5e686d24dfde76a6",
    reference
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "billstack.ng",
      path: "/api/v1/payment/verify",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: data
          });
        } catch (e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: "Parse error" }) });
        }
      });
    });

    req.on("error", (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
