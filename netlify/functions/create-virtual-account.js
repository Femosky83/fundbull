const https = require("https");

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

  const { userId, email, firstName, lastName, phone } = JSON.parse(event.body || "{}");

  const payload = JSON.stringify({
    reference: userId,
    email: email,
    firstName: firstName,
    lastName: lastName,
    phone: phone,
    bank: "PROVIDUS"
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "api.billstack.co",
      path: "/v2/thirdparty/generateVirtualAccount/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer Bill_Stack-SEC-KEY-cfbc43b6f6c81be640068db360f16dac",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log("Billstack raw response:", data);
        resolve({
          statusCode: 200,
          headers: { 
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
          },
          body: data
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        statusCode: 504,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Billstack API timed out. Try again." })
      });
    });

    req.on("error", (e) => {
      console.error("Billstack request error:", e.message);
      resolve({
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: e.message })
      });
    });

    req.write(payload);
    req.end();
  });
};
