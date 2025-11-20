// utils/appUserEvents.js
const { getIO } = require("./io");

function emitAppUserCreated(appId, payload) {
  try {
    const io = getIO();
    io.to(`app:${appId}`).emit("app-user:created", {
      appId,
      at: new Date().toISOString(),
      ...payload,
    });
    console.log(`📢 [appUserEvents] user-created → app:${appId}`, payload);
    return payload;
  } catch (e) {
    console.warn("[appUserEvents] emitAppUserCreated skipped:", e.message);
    return null;
  }
}

function emitAppUserUpdated(appId, payload) {
  try {
    const io = getIO();
    io.to(`app:${appId}`).emit("app-user:updated", {
      appId,
      at: new Date().toISOString(),
      ...payload,
    });
    console.log(`📢 [appUserEvents] user-updated → app:${appId}`, payload);
    return payload;
  } catch (e) {
    console.warn("[appUserEvents] emitAppUserUpdated skipped:", e.message);
    return null;
  }
}

function emitAppUserDeleted(appId, payload) {
  try {
    const io = getIO();
    io.to(`app:${appId}`).emit("app-user:deleted", {
      appId,
      at: new Date().toISOString(),
      ...payload,
    });
    console.log(`📢 [appUserEvents] user-deleted → app:${appId}`, payload);
    return payload;
  } catch (e) {
    console.warn("[appUserEvents] emitAppUserDeleted skipped:", e.message);
    return null;
  }
}

module.exports = { emitAppUserCreated, emitAppUserUpdated, emitAppUserDeleted };

