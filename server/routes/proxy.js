const express = require("express");
const axios = require("axios");
const https = require("https");

const router = express.Router();

/**
 * GET /mock-quote
 * Proxy endpoint to fetch a mock quote from an external service and return it to the frontend.
 * Query parameters:
 *  - url (optional): override the target URL to proxy
 *
 * Security/behavior:
 *  - By default the server will perform a normal HTTPS request. If you are running in an
 *    environment where the external service certificate cannot be validated (dev/test),
 *    set PROXY_IGNORE_TLS=true in the server environment to skip certificate validation
 *    for the proxied request. Use with caution — do NOT enable in production.
 */
router.get("/mock-quote", async (req, res) => {
  const targetUrl =
    (req.query && req.query.url) ||
    "https://run.mocky.io/v3/5185415ba171ea3a00704eed";

  try {
    // Allow bypassing TLS verification for development/testing in two ways:
    // 1) Set PROXY_IGNORE_TLS=true in server env
    // 2) Pass ?ignoreTls=true in the request query (dev only)
    const ignoreTls =
      process.env.PROXY_IGNORE_TLS === "true" ||
      (req.query && String(req.query.ignoreTls) === "true");

    const response = await axios.get(targetUrl, {
      timeout: 15000,
      httpsAgent: ignoreTls
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined,
      // allow larger payloads if needed
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
      validateStatus: () => true,
    });

    return res.status(200).json({
      success: true,
      status: response.status,
      headers: response.headers,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ [PROXY] Error fetching target URL:", targetUrl, error.message || error);
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        status: error.response.status,
        data: error.response.data,
        error: error.message,
      });
    }

    return res.status(502).json({ success: false, error: error.message || "Proxy error" });
  }
});

module.exports = router;
