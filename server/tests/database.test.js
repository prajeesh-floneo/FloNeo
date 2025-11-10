// // server/tests/database.test.js
// const request = require("supertest");
// const app = require("../index"); // Import your Express app
// require("dotenv").config();

// const TEST_APP_ID = process.env.TEST_APP_ID || 1;
// const TEST_TABLE_NAME = process.env.TEST_TABLE || "users";
// const TEST_JWT = process.env.TEST_JWT; // Set this before running tests

// describe("🧪 FloNeo Database API Tests", () => {
//   if (!TEST_JWT) {
//     console.error("❌ Missing TEST_JWT in environment variables");
//     process.exit(1);
//   }

//   // Test: /tables
//   it("should fetch all tables for an app", async () => {
//     const res = await request(app)
//       .get(`/api/database/${TEST_APP_ID}/tables`)
//       .set("Authorization", `Bearer ${TEST_JWT}`);

//     expect(res.statusCode).toBe(200);
//     expect(res.body.success).toBe(true);
//     expect(Array.isArray(res.body.tables)).toBe(true);

//     console.log("✅ /tables ->", res.body.tables.length, "tables found");
//   });

//   // Test: /tables/:tableName/data
//   it("should fetch data from a table", async () => {
//     const res = await request(app)
//       .get(`/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`)
//       .set("Authorization", `Bearer ${TEST_JWT}`);

//     if (res.statusCode === 404) {
//       console.warn("⚠️ Table not found in metadata or DB yet");
//     } else {
//       expect(res.statusCode).toBe(200);
//       expect(res.body.success).toBe(true);
//       console.log("✅ /data ->", res.body.data?.length || 0, "rows fetched");
//     }
//   });

//   // Test: /tables/:tableName/export
//   it("should export table data as CSV", async () => {
//     const res = await request(app)
//       .post(`/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`)
//       .set("Authorization", `Bearer ${TEST_JWT}`)
//       .send({ format: "csv" });

//     if (res.statusCode === 404) {
//       console.warn("⚠️ Table not found for export");
//     } else {
//       expect(res.statusCode).toBe(200);
//       expect(res.headers["content-type"]).toMatch(/text\/csv/);
//       console.log("✅ /export -> CSV data received successfully");
//     }
//   });
// });




// server/tests/database.test.js
// const request = require("supertest");
// const app = require("../index");
// require("dotenv").config();

// const TEST_APP_ID = process.env.TEST_APP_ID || 1;
// const TEST_TABLE_NAME = process.env.TEST_TABLE || "users";
// const TEST_JWT = process.env.TEST_JWT;

// describe("🧪 FloNeo Database API Tests", () => {
//   if (!TEST_JWT) {
//     console.error("❌ Missing TEST_JWT in environment variables");
//     process.exit(1);
//   }

//   beforeAll(() => {
//     console.log("\n🚀 Starting FloNeo backend API test suite...");
//     console.log(`🧩 Using App ID: ${TEST_APP_ID}`);
//     console.log(`🧩 Using Table: ${TEST_TABLE_NAME}`);
//   });

//   // Test 1️⃣: Tables list API
//   it("should fetch all tables for an app", async () => {
//     console.log("\n📡 Requesting: GET /api/database/:appId/tables");
//     const res = await request(app)
//       .get(`/api/database/${TEST_APP_ID}/tables`)
//       .set("Authorization", `Bearer ${TEST_JWT}`);

//     console.log("📥 Response:", res.statusCode, res.body.message || "OK");

//     if (res.statusCode === 401) console.error("❌ Unauthorized — check JWT token");
//     if (res.statusCode === 403) console.error("❌ Forbidden — check app ownership");

//     expect(res.statusCode).toBe(200);
//     expect(res.body.success).toBe(true);
//     expect(Array.isArray(res.body.tables)).toBe(true);

//     console.log(`✅ /tables -> Found ${res.body.tables.length} tables`);
//   });

//   // Test 2️⃣: Table data API
//   it("should fetch data from a table", async () => {
//     console.log(`\n📡 Requesting: GET /api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`);
//     const res = await request(app)
//       .get(`/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`)
//       .set("Authorization", `Bearer ${TEST_JWT}`);

//     console.log("📥 Response:", res.statusCode, res.body.message || "OK");

//     if (res.statusCode === 404) {
//       console.warn("⚠️ Table not found in metadata or DB yet");
//     } else {
//       expect(res.statusCode).toBe(200);
//       expect(res.body.success).toBe(true);
//       console.log(`✅ /data -> ${res.body.data?.length || 0} rows fetched`);
//     }
//   });

//   // Test 3️⃣: Export CSV API
//   it("should export table data as CSV", async () => {
//     console.log(`\n📡 Requesting: POST /api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`);
//     const res = await request(app)
//       .post(`/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`)
//       .set("Authorization", `Bearer ${TEST_JWT}`)
//       .send({ format: "csv" });

//     console.log("📥 Response:", res.statusCode, res.headers["content-type"]);

//     if (res.statusCode === 404) {
//       console.warn("⚠️ Table not found for export");
//     } else {
//       expect(res.statusCode).toBe(200);
//       expect(res.headers["content-type"]).toMatch(/text\/csv/);
//       console.log("✅ /export -> CSV data received successfully");
//     }
//   });

//   afterAll(() => {
//     console.log("\n🏁 Finished FloNeo database API test suite ✅\n");
//   });
// });





/* eslint-disable no-console */
// process.env.NODE_ENV = "test";

// const request = require("supertest");
// const app = require("../index");
// require("dotenv").config();

// // --- Force Jest to always print logs to stdout ---
// jest.spyOn(console, "log").mockImplementation((...args) => {
//   process.stdout.write(args.join(" ") + "\n");
// });
// jest.spyOn(console, "warn").mockImplementation((...args) => {
//   process.stdout.write("⚠️ " + args.join(" ") + "\n");
// });
// jest.spyOn(console, "error").mockImplementation((...args) => {
//   process.stdout.write("❌ " + args.join(" ") + "\n");
// });

// const TEST_APP_ID = process.env.TEST_APP_ID || 1;
// const TEST_TABLE_NAME = process.env.TEST_TABLE || "users";
// const TEST_JWT = process.env.TEST_JWT;

// describe("🧪 FloNeo Database API Tests", () => {
//   if (!TEST_JWT) {
//     console.error("❌ Missing TEST_JWT in environment variables");
//     process.exit(1);
//   }

//   beforeAll(() => {
//     console.log("\n🚀 Starting FloNeo backend API test suite...");
//     console.log(`🧩 Using App ID: ${TEST_APP_ID}`);
//     console.log(`🧩 Using Table: ${TEST_TABLE_NAME}`);
//   });

//   // Test 1️⃣: Tables list API
//   it("should fetch all tables for an app", async () => {
//     console.log("\n📡 Requesting: GET /api/database/:appId/tables");

//     const res = await request(app)
//       .get(`/api/database/${TEST_APP_ID}/tables`)
//       .set("Authorization", `Bearer ${TEST_JWT}`);

//     console.log("📥 Response:", res.statusCode, res.body.message || "OK");

//     if (res.statusCode === 401) console.error("❌ Unauthorized — check JWT token");
//     if (res.statusCode === 403) console.error("❌ Forbidden — check app ownership");

//     expect(res.statusCode).toBe(200);
//     expect(res.body.success).toBe(true);
//     expect(Array.isArray(res.body.tables)).toBe(true);

//     console.log(`✅ /tables -> Found ${res.body.tables.length} tables`);
//   });

//   // Test 2️⃣: Table data API
//   it("should fetch data from a table", async () => {
//     console.log(
//       `\n📡 Requesting: GET /api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`
//     );

//     const res = await request(app)
//       .get(
//         `/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`
//       )
//       .set("Authorization", `Bearer ${TEST_JWT}`);

//     console.log("📥 Response:", res.statusCode, res.body.message || "OK");

//     if (res.statusCode === 404) {
//       console.warn("⚠️ Table not found in metadata or DB yet");
//     } else {
//       expect(res.statusCode).toBe(200);
//       expect(res.body.success).toBe(true);
//       console.log(`✅ /data -> ${res.body.data?.length || 0} rows fetched`);
//     }
//   });

//   // Test 3️⃣: Export CSV API
//   it("should export table data as CSV", async () => {
//     console.log(
//       `\n📡 Requesting: POST /api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`
//     );

//     const res = await request(app)
//       .post(
//         `/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`
//       )
//       .set("Authorization", `Bearer ${TEST_JWT}`)
//       .send({ format: "csv" });

//     console.log("📥 Response:", res.statusCode, res.headers["content-type"]);

//     if (res.statusCode === 404) {
//       console.warn("⚠️ Table not found for export");
//     } else {
//       expect(res.statusCode).toBe(200);
//       expect(res.headers["content-type"]).toMatch(/text\/csv/);
//       console.log("✅ /export -> CSV data received successfully");
//     }
//   });

//   // ✅ Cleanup to prevent Jest timeout warnings
//   afterAll(() => {
//     console.log("\n🧹 Cleaning up test environment...");
//     const activeHandles = setInterval(() => {}, 999999);
//     for (let i = 1; i <= activeHandles; i++) clearInterval(i);
//     console.log("🧹 Cleared all active intervals after tests ✅");
//     console.log("\n🏁 Finished FloNeo database API test suite ✅\n");
//   });
// });


// server/tests/database.test.js
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../index");
require("dotenv").config();

// --- Force Jest to always print logs to stdout ---
jest.spyOn(console, "log").mockImplementation((...args) => {
  process.stdout.write(args.join(" ") + "\n");
});
jest.spyOn(console, "warn").mockImplementation((...args) => {
  process.stdout.write("⚠️ " + args.join(" ") + "\n");
});
jest.spyOn(console, "error").mockImplementation((...args) => {
  process.stdout.write("❌ " + args.join(" ") + "\n");
});

const TEST_APP_ID = parseInt(process.env.TEST_APP_ID) || 1;
const TEST_TABLE_NAME = process.env.TEST_TABLE || "users";
const TEST_JWT = process.env.TEST_JWT;

describe("🧪 FloNeo Database API Tests", () => {
  if (!TEST_JWT) {
    console.error("❌ Missing TEST_JWT in environment variables");
    process.exit(1);
  }

  beforeAll(() => {
    console.log("\n🚀 Starting FloNeo backend API test suite...");
    console.log(`🧩 Using App ID: ${TEST_APP_ID}`);
    console.log(`🧩 Using Table: ${TEST_TABLE_NAME}`);
  });

  // Test 1️⃣: Tables list API
  it("should fetch all tables for an app", async () => {
    console.log("\n📡 Requesting: GET /api/database/:appId/tables");

    const res = await request(app)
      .get(`/api/database/${TEST_APP_ID}/tables`)
      .set("Authorization", `Bearer ${TEST_JWT}`);

    console.log("📥 Response:", res.statusCode, res.body.message || "OK");

    if (res.statusCode === 401) console.error("❌ Unauthorized — check JWT token");
    if (res.statusCode === 403) console.error("❌ Forbidden — check app ownership");

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.tables)).toBe(true);

    console.log(`✅ /tables -> Found ${res.body.tables.length} tables`);
  });

  // Test 2️⃣: Table data API
  it("should fetch data from a table", async () => {
    console.log(
      `\n📡 Requesting: GET /api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`
    );

    const res = await request(app)
      .get(`/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/data?page=1&limit=5`)
      .set("Authorization", `Bearer ${TEST_JWT}`);

    console.log("📥 Response:", res.statusCode, res.body.message || "OK");

    if (res.statusCode === 404) {
      console.warn("⚠️ Table not found in metadata or DB yet");
    } else {
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      console.log(`✅ /data -> ${res.body.data?.length || 0} rows fetched`);
    }
  });

  // Test 3️⃣: Export CSV API
  it("should export table data as CSV", async () => {
    console.log(
      `\n📡 Requesting: POST /api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`
    );

    const res = await request(app)
      .post(`/api/database/${TEST_APP_ID}/tables/${TEST_TABLE_NAME}/export`)
      .set("Authorization", `Bearer ${TEST_JWT}`)
      .send({ format: "csv" });

    console.log("📥 Response:", res.statusCode, res.headers["content-type"]);

    if (res.statusCode === 404) {
      console.warn("⚠️ Table not found for export");
    } else {
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      console.log("✅ /export -> CSV data received successfully");
    }
  });

  // Test 4️⃣: Unauthorized (Missing JWT)
  it("should return 401 if no token is provided", async () => {
    console.log("\n🔒 Testing: GET /api/database/:appId/tables without token");
    const res = await request(app).get(`/api/database/${TEST_APP_ID}/tables`);
    console.log("📥 Response:", res.statusCode, res.body.message || res.text);
    expect(res.statusCode).toBe(401);
  });

  // Test 5️⃣: Forbidden (Different app access)
  it("should return 403 if accessing unauthorized app", async () => {
    console.log("\n🚫 Testing: GET /api/database/:appId/tables with wrong app access");
    const wrongAppId = TEST_APP_ID + 999; // assuming user doesn’t own this app
    const res = await request(app)
      .get(`/api/database/${wrongAppId}/tables`)
      .set("Authorization", `Bearer ${TEST_JWT}`);
    console.log("📥 Response:", res.statusCode, res.body.message || res.text);
    expect([403, 404]).toContain(res.statusCode); // some systems return 404 for hidden apps
  });

  // ✅ Cleanup to prevent Jest timeout warnings
  afterAll(() => {
    console.log("\n🧹 Cleaning up test environment...");
    const activeHandles = setInterval(() => {}, 999999);
    for (let i = 1; i <= activeHandles; i++) clearInterval(i);
    console.log("🧹 Cleared all active intervals after tests ✅");
    console.log("\n🏁 Finished FloNeo database API test suite ✅\n");
  });
});
