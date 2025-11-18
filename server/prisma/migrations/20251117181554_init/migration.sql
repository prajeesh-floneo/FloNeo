-- CreateTable
CREATE TABLE "public"."AppUser" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppRole" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isPredefined" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppUserRole" (
    "id" SERIAL NOT NULL,
    "appUserId" INTEGER NOT NULL,
    "appRoleId" INTEGER NOT NULL,
    "grantedBy" INTEGER,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppPage" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolePage" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "pageId" INTEGER NOT NULL,

    CONSTRAINT "RolePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PageAccess" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "appUserId" INTEGER NOT NULL,
    "pageId" INTEGER NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoleLog" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER,
    "appUserId" INTEGER,
    "actorId" INTEGER,
    "roleSlug" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "workflowId" INTEGER,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppUser_appId_idx" ON "public"."AppUser"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_appId_email_key" ON "public"."AppUser"("appId", "email");

-- CreateIndex
CREATE INDEX "AppRole_appId_idx" ON "public"."AppRole"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AppRole_appId_slug_key" ON "public"."AppRole"("appId", "slug");

-- CreateIndex
CREATE INDEX "AppUserRole_appUserId_idx" ON "public"."AppUserRole"("appUserId");

-- CreateIndex
CREATE INDEX "AppUserRole_appRoleId_idx" ON "public"."AppUserRole"("appRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUserRole_appUserId_appRoleId_key" ON "public"."AppUserRole"("appUserId", "appRoleId");

-- CreateIndex
CREATE INDEX "AppPage_appId_idx" ON "public"."AppPage"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AppPage_appId_slug_key" ON "public"."AppPage"("appId", "slug");

-- CreateIndex
CREATE INDEX "RolePage_roleId_idx" ON "public"."RolePage"("roleId");

-- CreateIndex
CREATE INDEX "RolePage_pageId_idx" ON "public"."RolePage"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePage_roleId_pageId_key" ON "public"."RolePage"("roleId", "pageId");

-- CreateIndex
CREATE INDEX "PageAccess_appId_idx" ON "public"."PageAccess"("appId");

-- CreateIndex
CREATE INDEX "PageAccess_appUserId_idx" ON "public"."PageAccess"("appUserId");

-- CreateIndex
CREATE INDEX "PageAccess_pageId_idx" ON "public"."PageAccess"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "PageAccess_appUserId_pageId_key" ON "public"."PageAccess"("appUserId", "pageId");

-- CreateIndex
CREATE INDEX "RoleLog_appId_idx" ON "public"."RoleLog"("appId");

-- CreateIndex
CREATE INDEX "RoleLog_appUserId_idx" ON "public"."RoleLog"("appUserId");

-- CreateIndex
CREATE INDEX "RoleLog_createdAt_idx" ON "public"."RoleLog"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."AppUser" ADD CONSTRAINT "AppUser_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppRole" ADD CONSTRAINT "AppRole_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppUserRole" ADD CONSTRAINT "AppUserRole_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppUserRole" ADD CONSTRAINT "AppUserRole_appRoleId_fkey" FOREIGN KEY ("appRoleId") REFERENCES "public"."AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppPage" ADD CONSTRAINT "AppPage_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePage" ADD CONSTRAINT "RolePage_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePage" ADD CONSTRAINT "RolePage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."AppPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PageAccess" ADD CONSTRAINT "PageAccess_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PageAccess" ADD CONSTRAINT "PageAccess_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PageAccess" ADD CONSTRAINT "PageAccess_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."AppPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoleLog" ADD CONSTRAINT "RoleLog_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
