const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  createStandardError,
  asyncHandler,
  createSuccessResponse,
} = require("../utils/errorHandler");

// Socket.io instance will be injected
let io = null;

// Method to inject Socket.io instance
const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// Mock AI-generated app ideas for investor demo
const AI_APP_IDEAS = [
  {
    id: 1,
    name: "Smart Insurance Quote Generator",
    description:
      "AI-powered insurance quote tool that analyzes customer data and provides instant, personalized quotes for health, auto, home, and life insurance policies.",
    suggestedTemplate: "Insurance Form App",
    templateId: 4,
    category: "Insurance",
    aiFeatures: [
      "Risk assessment algorithms",
      "Dynamic pricing models",
      "Customer profiling",
      "Automated underwriting",
    ],
    estimatedDevelopmentTime: "2-3 weeks",
    businessValue: "High - Reduces quote processing time by 80%",
    complexity: "Medium",
  },
  {
    id: 2,
    name: "Customer Insights Dashboard",
    description:
      "AI analytics platform for CRM data that provides predictive insights, customer lifetime value calculations, and automated lead scoring.",
    suggestedTemplate: "CRM Template",
    templateId: 5,
    category: "CRM",
    aiFeatures: [
      "Predictive analytics",
      "Lead scoring algorithms",
      "Customer segmentation",
      "Churn prediction",
    ],
    estimatedDevelopmentTime: "3-4 weeks",
    businessValue: "Very High - Increases sales conversion by 35%",
    complexity: "High",
  },
  {
    id: 3,
    name: "Intelligent Form Builder",
    description:
      "AI-driven form creation tool that automatically generates optimized forms based on industry best practices and user behavior patterns.",
    suggestedTemplate: "Basic Form App",
    templateId: 1,
    category: "Forms",
    aiFeatures: [
      "Smart field suggestions",
      "Conversion optimization",
      "A/B testing automation",
      "User experience analytics",
    ],
    estimatedDevelopmentTime: "1-2 weeks",
    businessValue: "Medium - Improves form completion rates by 25%",
    complexity: "Low",
  },
  {
    id: 4,
    name: "E-commerce Recommendation Engine",
    description:
      "AI-powered product recommendation system that analyzes customer behavior, purchase history, and market trends to suggest relevant products.",
    suggestedTemplate: "E-commerce Starter",
    templateId: 3,
    category: "E-commerce",
    aiFeatures: [
      "Collaborative filtering",
      "Content-based recommendations",
      "Real-time personalization",
      "Cross-selling optimization",
    ],
    estimatedDevelopmentTime: "4-5 weeks",
    businessValue: "Very High - Increases average order value by 40%",
    complexity: "High",
  },
  {
    id: 5,
    name: "Predictive Analytics Dashboard",
    description:
      "AI-enhanced business intelligence dashboard that forecasts trends, identifies opportunities, and provides actionable insights from your data.",
    suggestedTemplate: "Dashboard Template",
    templateId: 2,
    category: "Dashboards",
    aiFeatures: [
      "Time series forecasting",
      "Anomaly detection",
      "Trend analysis",
      "Automated reporting",
    ],
    estimatedDevelopmentTime: "3-4 weeks",
    businessValue: "High - Improves decision-making speed by 50%",
    complexity: "Medium",
  },
];

/**
 * @swagger
 * /api/floneo-ai/ideas:
 *   get:
 *     summary: Get AI-generated app ideas
 *     description: Returns AI-suggested app ideas with recommended templates for rapid development
 *     tags:
 *       - Floneo AI
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Insurance, CRM, Forms, E-commerce, Dashboards]
 *         description: Filter ideas by category
 *       - in: query
 *         name: complexity
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High]
 *         description: Filter ideas by complexity level
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 5
 *         description: Number of ideas to return
 *     responses:
 *       200:
 *         description: AI ideas retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "AI ideas generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     ideas:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           suggestedTemplate:
 *                             type: string
 *                           templateId:
 *                             type: integer
 *                           category:
 *                             type: string
 *                           aiFeatures:
 *                             type: array
 *                             items:
 *                               type: string
 *                           estimatedDevelopmentTime:
 *                             type: string
 *                           businessValue:
 *                             type: string
 *                           complexity:
 *                             type: string
 *                     totalIdeas:
 *                       type: integer
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get(
  "/ideas",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { category, complexity, limit = 5 } = req.query;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Filter ideas based on query parameters
    let filteredIdeas = [...AI_APP_IDEAS];

    if (category) {
      filteredIdeas = filteredIdeas.filter(
        (idea) => idea.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (complexity) {
      filteredIdeas = filteredIdeas.filter(
        (idea) => idea.complexity.toLowerCase() === complexity.toLowerCase()
      );
    }

    // Limit results
    const limitNum = Math.min(parseInt(limit) || 5, 10);
    const ideas = filteredIdeas.slice(0, limitNum);

    // Emit Socket.io event for real-time AI suggestions
    if (io) {
      const eventData = {
        userId,
        userEmail,
        action: "ai_ideas_generated",
        ideaCount: ideas.length,
        categories: [...new Set(ideas.map((idea) => idea.category))],
        filters: { category, complexity, limit: limitNum },
        timestamp: new Date().toISOString(),
      };

      // Emit to user's personal room
      io.to(`user_${userId}`).emit("ai:idea-generated", eventData);

      // Also emit general AI activity event
      io.emit("ai:activity", {
        type: "ideas_generated",
        user: userEmail,
        count: ideas.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Log AI activity
    console.log(
      `🤖 AI Ideas generated for user ${userEmail}: ${ideas.length} ideas`
    );

    res.json(
      createSuccessResponse("AI ideas generated successfully", {
        ideas,
        totalIdeas: ideas.length,
        availableCategories: [
          "Insurance",
          "CRM",
          "Forms",
          "E-commerce",
          "Dashboards",
        ],
        availableComplexities: ["Low", "Medium", "High"],
        generatedAt: new Date().toISOString(),
        aiEngine: "Floneo AI v1.0",
        filters: {
          category: category || "all",
          complexity: complexity || "all",
          limit: limitNum,
        },
      })
    );
  })
);

/**
 * @swagger
 * /api/floneo-ai/status:
 *   get:
 *     summary: Get Floneo AI system status
 *     description: Returns the current status and capabilities of the Floneo AI system
 *     tags:
 *       - Floneo AI
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI system status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     version:
 *                       type: string
 *                     capabilities:
 *                       type: array
 *                       items:
 *                         type: string
 *                     totalIdeas:
 *                       type: integer
 */
router.get(
  "/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    res.json(
      createSuccessResponse("Floneo AI status retrieved successfully", {
        status: "active",
        version: "1.0.0",
        capabilities: [
          "App idea generation",
          "Template recommendations",
          "Business value analysis",
          "Development time estimation",
          "Complexity assessment",
        ],
        totalIdeas: AI_APP_IDEAS.length,
        categories: ["Insurance", "CRM", "Forms", "E-commerce", "Dashboards"],
        lastUpdated: new Date().toISOString(),
      })
    );
  })
);

// POST /api/ai/summarize - Summarize document text using Gemini
router.post(
  "/summarize",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { text, apiKey } = req.body;

    if (!text || typeof text !== "string") {
      return res
        .status(400)
        .json(createStandardError("Text content is required", "INVALID_INPUT"));
    }

    if (!apiKey || typeof apiKey !== "string") {
      return res
        .status(400)
        .json(
          createStandardError("Gemini API key is required", "INVALID_INPUT")
        );
    }

    try {
      const { summarizeText } = require("../utils/ai-summarizer");

      console.log("🧠 [AI-SUMMARIZE] Starting summarization:", {
        textLength: text.length,
        userId: req.user.id,
      });

      const summary = await summarizeText(text, apiKey);

      console.log("✅ [AI-SUMMARIZE] Summarization completed successfully");

      return res.json(
        createSuccessResponse({
          summary,
          originalLength: text.length,
          summaryLength: summary.length,
          compressionRatio:
            ((1 - summary.length / text.length) * 100).toFixed(2) + "%",
        })
      );
    } catch (error) {
      console.error("❌ [AI-SUMMARIZE] Error:", error.message);

      // Return appropriate error based on error type
      if (error.message.includes("Invalid Gemini API key")) {
        return res
          .status(401)
          .json(createStandardError("Invalid Gemini API key", "AUTH_ERROR"));
      }

      if (error.message.includes("Rate limit")) {
        return res
          .status(429)
          .json(
            createStandardError(
              "Rate limit exceeded. Please try again later.",
              "RATE_LIMIT"
            )
          );
      }

      return res
        .status(500)
        .json(createStandardError(error.message, "SUMMARIZATION_ERROR"));
    }
  })
);

module.exports = router;
module.exports.setSocketIO = setSocketIO;
