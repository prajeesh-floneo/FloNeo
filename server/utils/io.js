let ioRef = null;

function setIO(ioInstance) {
  ioRef = ioInstance;
}

function getIO() {
  if (!ioRef) throw new Error("Socket.io not initialized yet");
  return ioRef;
}

module.exports = { setIO, getIO };
