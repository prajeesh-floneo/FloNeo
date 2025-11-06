// server/socket/index.js
const { getIO } = require("../utils/io");
const { emitTableCreated, emitDataUpdated } = require("../utils/dbEvents");

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // ✅ join app room
    socket.on("database:join-app", (appId) => {
      if (!appId) return socket.emit("error", "Invalid appId");
      socket.join(`app:${appId}`);
      console.log(`👥 ${socket.id} joined room app:${appId}`);
      socket.emit("database:joined", { appId, joined: true });
    });

    // ✅ leave app room
    socket.on("database:leave-app", (appId) => {
      socket.leave(`app:${appId}`);
      console.log(`👋 ${socket.id} left room app:${appId}`);
    });

    // 🔄 optional: fake test events from client
    // socket.on("database:test-event", (data) => {
    //   const { appId = 1, tableName = "users" } = data;
    //   emitDataUpdated(appId, {
    //     tableName,
    //     action: "update",
    //     rowsAffected: 1,
    //     preview: [{ id: 1, name: "Prince" }],
    //   });
    // });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });
}

module.exports = { setupSocket };
