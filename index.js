const ModbusRTU = require("modbus-serial");
const net = require("net");

// Create a new Modbus server
const server = new ModbusRTU.ServerTCP({
  holding: {}, // Define holding registers to store data
}, {
  host: "0.0.0.0",
  port: 1234,
}, () => {
  console.log("Modbus TCP Server is running on port 502");
});

// Listen for read/write requests from the S275
server.on("writeHoldingRegister", function (request, res) {
  const registerAddress = request.address;
  const registerValue = request.value;

  console.log(`Received value ${registerValue} at register address ${registerAddress}`);
  res(); // Send response back to the client (S275)
});

server.on("error", (err) => {
  console.error(`Modbus server error: ${err.message}`);
});
