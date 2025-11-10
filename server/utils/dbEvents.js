const { getIO } = require("./io");

function emitTableCreated(appId, { tableName, columns, createdBy }) {
  const io = getIO();
  const payload = {
    appId,
    tableName,
    columns,
    createdBy,
    timestamp: new Date().toISOString(),
  };
  io.to(`app:${appId}`).emit("database:table-created", payload);
  console.log("📡 Emitted -> database:table-created", payload);
  return payload;
}

function emitDataUpdated(appId, { tableName, action, rowsAffected, preview }) {
  const io = getIO();
  const payload = {
    appId,
    tableName,
    action,
    rowsAffected,
    preview,
    timestamp: new Date().toISOString(),
  };
  io.to(`app:${appId}`).emit("database:data-updated", payload);
  console.log("📡 Emitted -> database:data-updated", payload);
  return payload;
}

module.exports = { emitTableCreated, emitDataUpdated };
