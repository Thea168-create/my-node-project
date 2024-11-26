const net = require("net");

const server = net.createServer((socket) => {
  console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on("data", async (data) => {
    try {
      console.log(`Received data: ${data.toString("hex")}`);

      const unitID = data.readUInt8(0); // Unit ID
      const functionCode = data.readUInt8(1); // Function Code
      const startAddress = data.readUInt16BE(2); // Starting Address
      const quantity = data.readUInt16BE(4); // Number of Registers to Read

      if (functionCode === 0x04) { // Function Code 4: Read Input Registers
        const sensorData = await fetchSensorData(); // Fetch live data from RTU

        // Build Modbus response
        const response = Buffer.alloc(3 + quantity * 2);
        response.writeUInt8(unitID, 0); // Unit ID
        response.writeUInt8(functionCode, 1); // Function Code
        response.writeUInt8(quantity * 2, 2); // Byte Count

        // Map RTU data to response
        for (let i = 0; i < quantity; i++) {
          const registerAddress = startAddress + i * 2;

          // Map address to corresponding AIN value
          let value = 0;
          if (registerAddress === 20128) value = sensorData.AIN0 || 0;
          if (registerAddress === 20130) value = sensorData.AIN1 || 0;
          if (registerAddress === 20132) value = sensorData.AIN2 || 0;
          if (registerAddress === 20134) value = sensorData.AIN3 || 0;
          if (registerAddress === 20136) value = sensorData.AIN4 || 0;
          if (registerAddress === 20138) value = sensorData.AIN5 || 0;

          response.writeUInt16BE(value, 3 + i * 2);
        }

        console.log(`Responding with: ${response.toString("hex")}`);
        socket.write(response);
      } else {
        console.error(`Unsupported Function Code: ${functionCode}`);
        const errorResponse = Buffer.from([unitID, functionCode | 0x80, 0x01]);
        socket.write(errorResponse);
      }
    } catch (error) {
      console.error("Error processing request:", error.message);
    }
  });

  socket.on("close", () => {
    console.log(`Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
  });

  socket.on("error", (error) => {
    console.error(`Socket error: ${error.message}`);
  });
});

server.listen(1234, "0.0.0.0", () => {
  console.log("Modbus TCP server running on port 1234");
});
