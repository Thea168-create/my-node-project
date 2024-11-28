const ModbusRTU = require("modbus-serial");
const net = require("net");

const server = new ModbusRTU.ServerTCP({
  holding: {}, // Define holding registers to store data
}, {
  host: "0.0.0.0",
  port: 1234,
}, () => {
  console.log("Modbus TCP Server is running on port 502");
});

server.on("writeHoldingRegister", function (request, res) {
  const registerAddress = request.address;
  const registerValue = request.value;

  console.log(`Received value ${registerValue} at register address ${registerAddress}`);
  res(); // Send response back to the client (S275)
});

server.on("writeMultipleRegisters", function (request, res) {
  const address = request.address;
  const values = request.values;

  console.log(`Received multiple registers starting from ${address} with values: ${values}`);
  res(); // Send response back to the client (S275)
});

server.on("error", (err) => {
  console.error(`Modbus server error: ${err.message}`);
});

// Listening for client connection
server.on("connection", function () {
  console.log("Client connected to the server");
});
