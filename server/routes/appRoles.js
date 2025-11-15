const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * CREATE ROLE FOR AN APP
 * POST /api/app-roles/:appId/create
 */
router.post("/:appId/create", async (req, res) => {
  try {
    const { appId } = req.params;
    const { name, description, isPredefined } = req.body;

    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Role name required" });

    // Generate slug
    const slug = name.toLowerCase().replace(/\s+/g, "-");

    const exists = await prisma.appRole.findFirst({
      where: { appId: Number(appId), slug },
    });

    if (exists)
      return res.status(400).json({
        success: false,
        message: "Role already exists in this app",
      });

    const role = await prisma.appRole.create({
      data: {
        appId: Number(appId),
        name,
        slug,
        description: description || "",
        isPredefined: Boolean(isPredefined),
      },
    });

    res.json({ success: true, role });
  } catch (err) {
    console.error("ROLE CREATE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * LIST ROLES OF AN APP
 * GET /api/app-roles/:appId/list
 */
router.get("/:appId/list", async (req, res) => {
  try {
    const { appId } = req.params;

    const roles = await prisma.appRole.findMany({
      where: { appId: Number(appId) },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, roles });
  } catch (err) {
    console.error("ROLE LIST ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * ASSIGN PAGES TO ROLE
 * POST /api/app-roles/assign-pages/:roleId
 */
router.post("/assign-pages/:roleId", async (req, res) => {
  try {
    const { roleId } = req.params;
    const { pageIds } = req.body; // array of AppPage IDs

    if (!Array.isArray(pageIds))
      return res.status(400).json({
        success: false,
        message: "pageIds must be array",
      });

    // Delete old mappings
    await prisma.rolePage.deleteMany({
      where: { roleId: Number(roleId) },
    });

    // Insert new
    const rolePages = pageIds.map((pageId) => ({
      roleId: Number(roleId),
      pageId: Number(pageId),
    }));

    await prisma.rolePage.createMany({ data: rolePages });

    res.json({ success: true });
  } catch (err) {
    console.error("ASSIGN ROLE PAGES ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET PAGES ASSIGNED TO ROLE
 * GET /api/app-roles/:roleId/pages
 */
router.get("/:roleId/pages", async (req, res) => {
  try {
    const { roleId } = req.params;

    const pages = await prisma.rolePage.findMany({
      where: { roleId: Number(roleId) },
      include: { appPage: true },
    });

    res.json({
      success: true,
      pages: pages.map((p) => p.appPage),
    });
  } catch (err) {
    console.error("FETCH ROLE PAGES ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE A ROLE
 * DELETE /api/app-roles/:roleId/delete
 */
router.delete("/:roleId/delete", async (req, res) => {
  try {
    const { roleId } = req.params;

    // safety: cannot delete predefined roles
    const role = await prisma.appRole.findUnique({
      where: { id: Number(roleId) },
    });

    if (!role)
      return res.status(404).json({ success: false, message: "Role not found" });

    if (role.isPredefined)
      return res.status(400).json({
        success: false,
        message: "Cannot delete predefined role",
      });

    await prisma.rolePage.deleteMany({
      where: { roleId: Number(roleId) },
    });

    await prisma.appUserRole.deleteMany({
      where: { appRoleId: Number(roleId) },
    });

    await prisma.appRole.delete({
      where: { id: Number(roleId) },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("ROLE DELETE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * UPDATE ROLE DETAILS
 * PUT /api/app-roles/:roleId/update
 */
router.put("/:roleId/update", async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, description } = req.body;

    const role = await prisma.appRole.update({
      where: { id: Number(roleId) },
      data: {
        name,
        description,
      },
    });

    res.json({ success: true, role });
  } catch (err) {
    console.error("ROLE UPDATE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
