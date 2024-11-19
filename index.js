const ModbusRTU = require("modbus-serial");
const net = require("net");

// Create a Modbus TCP server using a simple TCP socket
const server = net.createServer();
const PORT = 1234; // Port for the Modbus server
const HOST = "0.0.0.0"; // Bind to all network interfaces

// Mock registers to simulate AIN values
const registers = {
  0x0000: 12300, // AIN0 value (e.g., 123.00 after dividing by 100)
  0x0002: 45600, // AIN1 value (e.g., 456.00 after dividing by 100)
  0x0004: 78900, // AIN2 value (e.g., 789.00 after dividing by 100)
  0x0006: 10100, // AIN3 value (e.g., 101.00 after dividing by 100)
  0x0008: 11200, // AIN4 value (e.g., 112.00 after dividing by 100)
  0x000A: 13100, // AIN5 value (e.g., 131.00 after dividing by 100)
};

// Handle incoming Modbus TCP requests
server.on("connection", (socket) => {
  console.log(`RTU connected: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on("data", (data) => {
    try {
      console.log(`Received request: ${data.toString("hex")}`);

      // Decode Modbus request
      const unitId = data.readUInt8(0); // Unit ID
      const functionCode = data.readUInt8(1); // Function Code
      const startAddress = data.readUInt16BE(2); // Starting Address
      const quantity = data.readUInt16BE(4); // Number of Registers to Read

      console.log(
        `Unit ID: ${unitId}, Function Code: ${functionCode}, Start Address: ${startAddress}, Quantity: ${quantity}`
      );

      if (functionCode === 0x04) {
        // Function Code 4: Read Input Registers
        const response = Buffer.alloc(3 + quantity * 2);
        response.writeUInt8(unitId, 0); // Unit ID
        response.writeUInt8(functionCode, 1); // Function Code
        response.writeUInt8(quantity * 2, 2); // Byte Count

        for (let i = 0; i < quantity; i++) {
          const registerValue = registers[startAddress + i * 2] || 0;
          response.writeUInt16BE(registerValue, 3 + i * 2);
        }

        socket.write(response);
        console.log(`Sent response: ${response.toString("hex")}`);
      } else {
        console.log("Unsupported function code.");
      }
    } catch (error) {
      console.error(`Error processing data: ${error.message}`);
    }
  });

  socket.on("close", () => {
    console.log("RTU disconnected.");
  });

  socket.on("error", (error) => {
    console.error(`Socket error: ${error.message}`);
  });
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Modbus TCP server running at ${HOST}:${PORT}`);
});
