const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * CREATE A PAGE FOR AN APP
 * POST /api/pages/:appId/create
 */
router.post("/:appId/create", async (req, res) => {
  try {
    const { appId } = req.params;
    const { title, slug, path } = req.body;

    if (!title || !slug)
      return res.status(400).json({
        success: false,
        message: "title and slug are required"
      });

    const page = await prisma.appPage.create({
      data: {
        appId: Number(appId),
        title,
        slug,
        path: path || `/${slug}`
      }
    });

    return res.json({ success: true, page });
  } catch (err) {
    console.error("❌ Create page error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});


/**
 * LIST PAGES OF AN APP
 * GET /api/pages/:appId/list
 */
router.get("/:appId/list", async (req, res) => {
  try {
    const { appId } = req.params;

    const pages = await prisma.appPage.findMany({
      where: { appId: Number(appId) },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ success: true, pages });
  } catch (err) {
    console.error("❌ Fetch pages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});


/**
 * ASSIGN PAGES TO APP USER
 * POST /api/pages/:appId/assign/:appUserId
 */
router.post("/:appId/assign/:appUserId", async (req, res) => {
  try {
    const { appUserId } = req.params;
    const { pageIds } = req.body; // array of IDs

    if (!Array.isArray(pageIds))
      return res.status(400).json({
        success: false,
        message: "pageIds must be an array"
      });

    // Delete old access
    await prisma.pageAccess.deleteMany({
      where: { appUserId: Number(appUserId) }
    });

    // Fetch all pages to get slug
    const pages = await prisma.appPage.findMany({
      where: { id: { in: pageIds } }
    });

    const accessData = pages.map((p) => ({
      appId: p.appId,
      appUserId: Number(appUserId),
      pageId: p.id,
      pageSlug: p.slug
    }));

    // Insert new access
    await prisma.pageAccess.createMany({ data: accessData });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Page assign error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});


/**
 * ROLE-BASED PAGE ACCESS
 * GET /api/pages/:appId/role/:roleId
 */
router.get("/:appId/role/:roleId", async (req, res) => {
  try {
    const { appId, roleId } = req.params;

    const rolePages = await prisma.rolePage.findMany({
      where: { roleId: Number(roleId) },
      include: { appPage: true }
    });

    return res.json({
      success: true,
      pages: rolePages.map(rp => rp.appPage)
    });
  } catch (err) {
    console.error("❌ Role pages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
