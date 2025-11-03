#!/usr/bin/env node

const http = require("http");

const credentials = {
  email: "demo@example.com",
  password: "Demo123!@#",
};

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

console.log("🔐 Getting Fresh Token...\n");

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const jsonData = JSON.parse(data);

      if (jsonData.success && jsonData.data?.accessToken) {
        const token = jsonData.data.accessToken;
        console.log("✅ Token obtained successfully!\n");
        console.log("Token:", token);
        console.log("\nExpires at:", jsonData.data.expiresAt);

        // Now fetch apps with this token
        console.log("\n🔍 Fetching Apps with new token...\n");

        const appsOptions = {
          hostname: "localhost",
          port: 5000,
          path: "/api/apps",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        };

        const appsReq = http.request(appsOptions, (appsRes) => {
          let appsData = "";

          appsRes.on("data", (chunk) => {
            appsData += chunk;
          });

          appsRes.on("end", () => {
            try {
              const appsJson = JSON.parse(appsData);
              console.log("Apps response:", JSON.stringify(appsJson, null, 2));

              if (appsJson.success && appsJson.data) {
                // Handle both nested (data.apps) and flat (data) structures
                const apps =
                  appsJson.data.apps ||
                  (Array.isArray(appsJson.data)
                    ? appsJson.data
                    : [appsJson.data]);
                console.log(`✅ Found ${apps.length} app(s):\n`);

                apps.forEach((app, idx) => {
                  console.log(`${idx + 1}. App ID: ${app.id}`);
                  console.log(`   Name: ${app.name}`);
                  console.log(`   Owner ID: ${app.ownerId}`);
                  console.log("");
                });
              } else {
                console.log("⚠️ No apps found");
                console.log("Response:", appsJson);
              }
            } catch (e) {
              console.log("Error parsing apps:", e.message);
              console.log("Raw data:", appsData);
            }
          });
        });

        appsReq.on("error", (error) => {
          console.error("❌ Apps request error:", error.message);
        });

        appsReq.end();
      } else {
        console.log("❌ Login failed");
        console.log("Response:", jsonData);
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Request error:", error.message);
});

req.write(JSON.stringify(credentials));
req.end();
