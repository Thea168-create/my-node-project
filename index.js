// Import required modules
const ModbusRTU = require("modbus-serial");
const net = require("net");
const winston = require("winston");
require("dotenv").config();

// Setup Winston Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: process.env.LOG_FILE || "combined.log" }),
  ],
});

// In-Memory Data Store for Modbus Registers
const holdingRegisters = new Array(10000).fill(0); // Simulate 10,000 holding registers

// Modbus Server Configuration
const server = new ModbusRTU.ServerTCP({
  holding: {},
  coils: {},
  discrete: {},
  inputs: {},
}, {
  host: "0.0.0.0",
  port: process.env.MODBUS_PORT || 1234,
}, () => {
  logger.info(`Modbus TCP Server is running on port ${process.env.MODBUS_PORT || 1234}`);
});

// Handle Modbus Write Holding Register (Function Code 06)
server.on("writeHoldingRegister", function (request, res) {
  const registerAddress = request.address;
  const registerValue = request.value;

  logger.info(`Received value ${registerValue} at register address ${registerAddress}`);

  // Update in-memory holding register
  if (registerAddress >= 0 && registerAddress < holdingRegisters.length) {
    holdingRegisters[registerAddress] = registerValue;
    logger.info(`Updated holding register at address ${registerAddress} with value ${registerValue}`);
  } else {
    logger.warn(`Attempt to write to an invalid register address: ${registerAddress}`);
  }

  res(); // Send response back to the client (S275)
});

// Handle Write Multiple Registers (Function Code 16)
server.on("writeMultipleRegisters", function (request, res) {
  const address = request.address;
  const values = request.values;

  logger.info(`Received multiple register values starting from address ${address} with values: ${values}`);

  // Update in-memory holding registers
  values.forEach((value, index) => {
    const registerAddress = address + index;
    if (registerAddress >= 0 && registerAddress < holdingRegisters.length) {
      holdingRegisters[registerAddress] = value;
      logger.info(`Updated holding register at address ${registerAddress} with value ${value}`);
    } else {
      logger.warn(`Attempt to write to an invalid register address: ${registerAddress}`);
    }
  });

  res(); // Send response back to the client (S275)
});

// Handle Read Holding Registers (Function Code 03)
server.on("readHoldingRegisters", function (request, res) {
  const address = request.address;
  const length = request.quantity;

  logger.info(`Received read request for ${length} registers starting from address ${address}`);

  // Fetch values from in-memory holding registers
  const values = holdingRegisters.slice(address, address + length);

  logger.info(`Responding with values: ${values}`);
  res.response.body.values = values;
  res(); // Send the response back to the client
});

// Handle Login and Heartbeat Messages via TCP
const tcpServer = net.createServer((socket) => {
  let heartbeatTimeout;

  const resetHeartbeatTimeout = () => {
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      logger.warn("No heartbeat received within expected interval. Client might be disconnected.");
      socket.end(); // Disconnect the client if no heartbeat is received in time
    }, 45000); // Set timeout slightly longer than the 40s heartbeat interval to allow buffer
  };

  logger.info("TCP Client connected");
  resetHeartbeatTimeout();

  // Handle Login and Other Messages
  socket.on("data", (data) => {
    const message = data.toString().trim();
    logger.info(`Received message from client: ${message}`);

    if (message === "Q2685SY008TX9765") {
      logger.info("Login message 'Q2685SY008TX9765' received");
      socket.write(""); // Respond with a blank acknowledgment (empty response)
      logger.info("Sent blank acknowledgment for login message");
    } else if (message === "Q") { // Handle Heartbeat Message from S275
      logger.info("Heartbeat message received");
      socket.write("A"); // Respond with Heartbeat ACK
      resetHeartbeatTimeout();
    } else {
      logger.warn(`Unexpected message received: ${message}`);
    }
  });

  // Handle Client Disconnection
  socket.on("end", () => {
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    logger.info("TCP Client disconnected");
  });

  socket.on("error", (err) => {
    logger.error(`TCP Socket error: ${err.message}`);
  });
});

// Start TCP Server for Heartbeat and Login Messages
tcpServer.listen(process.env.MODBUS_PORT || 1234, () => {
  logger.info(`TCP Server for heartbeat and login messages is running on port ${process.env.MODBUS_PORT || 1234}`);
});

// Handle Errors
server.on("error", (err) => {
  logger.error(`Modbus server error: ${err.message}`);
});
