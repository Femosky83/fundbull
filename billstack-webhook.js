exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");

    // Only handle reserved account payments
    if (payload.event !== "PAYMENT_NOTIFIFICATION" || 
        payload.data?.type !== "RESERVED_ACCOUNT_TRANSACTION") {
      return { statusCode: 200, body: "OK" };
    }

    const data = payload.data;
    const merchantRef = data.merchant_reference; // this is the userId we stored
    const amount = parseFloat(data.amount);
    const reference = data.reference;

    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = require("firebase-admin/app");
    const { getFirestore, FieldValue } = require("firebase-admin/firestore");

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: "fundbull-29d64",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
        })
      });
    }

    const db = getFirestore();

    // Check not duplicate
    const existing = await db.collection("deposits")
      .where("billstackRef", "==", reference).get();
    if (!existing.empty) {
      return { statusCode: 200, body: "Duplicate" };
    }

    // Find which plan this amount matches
    const NAIRA_PLANS = [
      {id:"bull1", name:"Bull 1", emoji:"🌱", price:5000, daily:625},
      {id:"bull2", name:"Bull 2", emoji:"⚡", price:15000, daily:1875},
      {id:"bull3", name:"Bull 3", emoji:"🌅", price:25000, daily:3125},
      {id:"bull4", name:"Bull 4", emoji:"🐂", price:35000, daily:4375},
      {id:"bull5", name:"Bull 5", emoji:"⛈", price:45000, daily:5625},
      {id:"bull6", name:"Bull 6", emoji:"🛡", price:100000, daily:12500},
      {id:"bull7", name:"Bull 7", emoji:"🔥", price:200000, daily:25000},
      {id:"bull8", name:"Bull 8", emoji:"⚫", price:300000, daily:37500},
      {id:"bull9", name:"Bull 9", emoji:"👑", price:400000, daily:50000},
      {id:"bull10", name:"Bull 10", emoji:"🚀", price:500000, daily:62500}
    ];

    const plan = NAIRA_PLANS.find(p => p.price === amount);

    // Save deposit record
    await db.collection("deposits").add({
      uid: merchantRef,
      planId: plan ? plan.id : "custom",
      planName: plan ? plan.name : "Custom",
      emoji: plan ? plan.emoji : "💰",
      amount: amount,
      currency: "NGN",
      method: "billstack",
      billstackRef: reference,
      status: "approved",
      autoApproved: true,
      createdAt: FieldValue.serverTimestamp()
    });

    // Credit user balance
    await db.collection("users").doc(merchantRef).update({
      balance: FieldValue.increment(amount)
    });

    // Create investment if plan matched
    if (plan) {
      await db.collection("investments").add({
        uid: merchantRef,
        planId: plan.id,
        planName: plan.name,
        emoji: plan.emoji,
        amount: amount,
        currency: "NGN",
        dailyEarning: plan.daily,
        status: "active",
        startDate: FieldValue.serverTimestamp()
      });
    }

    // Credit referral bonuses
    const userDoc = await db.collection("users").doc(merchantRef).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const bonuses = [
        { field: "refBy", pct: 0.10, label: "L1" },
        { field: "refL2", pct: 0.03, label: "L2" },
        { field: "refL3", pct: 0.02, label: "L3" }
      ];
      for (const b of bonuses) {
        if (userData[b.field]) {
          const bonus = amount * b.pct;
          await db.collection("users").doc(userData[b.field]).update({
            balance: FieldValue.increment(bonus),
            totalEarned: FieldValue.increment(bonus)
          });
          await db.collection("transactions").add({
            uid: userData[b.field],
            type: "credit",
            desc: `Referral Bonus (${b.label})`,
            amount: bonus,
            currency: "NGN",
            status: "approved",
            createdAt: FieldValue.serverTimestamp()
          });
        }
      }
    }

    // Log transaction for member
    await db.collection("transactions").add({
      uid: merchantRef,
      type: "credit",
      desc: "Recharge Approved - " + (plan ? plan.name : "NGN " + amount),
      amount: amount,
      currency: "NGN",
      status: "approved",
      createdAt: FieldValue.serverTimestamp()
    });

    return { statusCode: 200, body: "OK" };

  } catch (err) {
    console.error("Webhook error:", err);
    return { statusCode: 500, body: err.message };
  }
};
