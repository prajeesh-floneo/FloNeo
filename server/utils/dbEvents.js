// const { getIO } = require("./io");

// function emitTableCreated(appId, { tableName, columns, createdBy }) {
//   const io = getIO();
//   const payload = {
//     appId,
//     tableName,
//     columns,
//     createdBy,
//     timestamp: new Date().toISOString(),
//   };
//   io.to(`app:${appId}`).emit("database:table-created", payload);
//   console.log("📡 Emitted -> database:table-created", payload);
//   return payload;
// }

// function emitDataUpdated(appId, { tableName, action, rowsAffected, preview }) {
//   const io = getIO();
//   const payload = {
//     appId,
//     tableName,
//     action,
//     rowsAffected,
//     preview,
//     timestamp: new Date().toISOString(),
//   };
//   io.to(`app:${appId}`).emit("database:data-updated", payload);
//   console.log("📡 Emitted -> database:data-updated", payload);
//   return payload;
// }

// module.exports = { emitTableCreated, emitDataUpdated };


// utils/dbEvents.js
const { getIO } = require("./io");

function emitDataUpdated(appId, payload) {
  try {
    const io = getIO();
    io.to(`app:${appId}`).emit("database:data-updated", {
      appId,
      at: new Date().toISOString(),
      ...payload,
    });
    // Optional global channel
    io.emit("record:updated", { appId, ...payload });
    console.log(`📢 [dbEvents] data-updated → app:${appId}`, payload);
    return payload;
  } catch (e) {
    console.warn("[dbEvents] emitDataUpdated skipped:", e.message);
    return null;
  }
}

function emitTableCreated(appId, payload) {
  try {
    const io = getIO();
    io.to(`app:${appId}`).emit("database:table-created", {
      appId,
      at: new Date().toISOString(),
      ...payload,
    });
    console.log(`📢 [dbEvents] table-created → app:${appId}`, payload);
    return payload;
  } catch (e) {
    console.warn("[dbEvents] emitTableCreated skipped:", e.message);
    return null;
  }
}

module.exports = { emitDataUpdated, emitTableCreated };
