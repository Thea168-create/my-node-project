const ModbusRTU = require("modbus-serial");

// Create a simple Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    // No actual register logic, just an example to confirm connection
    // You can add real Modbus functionality later
  },
  {
    host: "0.0.0.0",  // Listen on all available interfaces
    port: 1234,       // Modbus TCP port
    debug: true,      // Enable debugging (optional)
  }
);

console.log("Modbus TCP Server is running on port 1234");

// Handle client connections and log the connection details
modbusServer.on("connection", (socket) => {
  const clientIP = socket.remoteAddress;  // Get the client's IP address
  const clientPort = socket.remotePort;  // Get the client's port
  console.log(`New client connected: ${clientIP}:${clientPort}`);
});

// MongoDB logging for errors (optional)
modbusServer.on("error", (error) => {
  console.error("Modbus Server Error:", error);
});
