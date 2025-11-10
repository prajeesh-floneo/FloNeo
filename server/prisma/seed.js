const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create demo user
  const hashedPassword = await bcrypt.hash("Demo123!@#", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password: hashedPassword,
      role: "developer",
      verified: true,
    },
  });

  console.log("✅ Demo user created:", {
    id: demoUser.id,
    email: demoUser.email,
    role: demoUser.role,
    verified: demoUser.verified,
  });

  // Create Ajith user
  const ajithHashedPassword = await bcrypt.hash("floneo123!@#", 12);

  const ajithUser = await prisma.user.upsert({
    where: { email: "ajith@floneo.co" },
    update: {},
    create: {
      email: "ajith@floneo.co",
      password: ajithHashedPassword,
      role: "developer",
      verified: true,
    },
  });

  console.log("✅ Ajith user created:", {
    id: ajithUser.id,
    email: ajithUser.email,
    role: ajithUser.role,
    verified: ajithUser.verified,
  });

  // Create some sample templates if they don't exist
  const templates = [
    {
      name: "Basic Form",
      description: "A simple form template with input fields and validation",
      preview_image: "/templates/basic-form.png",
      category: "Forms",
      app_schema: {
        elements: [
          { type: "INPUT", label: "Name", required: true },
          { type: "INPUT", label: "Email", required: true, inputType: "email" },
          { type: "BUTTON", label: "Submit", variant: "primary" },
        ],
      },
    },
    {
      name: "Dashboard",
      description: "A comprehensive dashboard template with charts and metrics",
      preview_image: "/templates/dashboard.png",
      category: "Analytics",
      app_schema: {
        elements: [
          { type: "CARD", title: "Total Users", value: "1,234" },
          { type: "CHART", chartType: "line", data: [] },
          { type: "TABLE", columns: ["Name", "Status", "Date"] },
        ],
      },
    },
  ];

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    await prisma.template.upsert({
      where: { id: i + 1 },
      update: {},
      create: { id: i + 1, ...template },
    });
  }

  console.log("✅ Templates seeded successfully");
  console.log("🎉 Database seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
