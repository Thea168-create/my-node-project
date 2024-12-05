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

// Real sensor data registers (20128 to 20254)
const sensorDataRegisters = {
  20128: 0, // AI0 sensor
  20130: 0, // AI1 sensor
  20132: 0, // AI2 sensor
  20134: 0, // AI3 sensor
  20136: 0, // AI4 sensor
  20138: 0, // AI5 sensor
};

// Modbus Server Configuration
const server = new ModbusRTU.ServerTCP({
  holding: sensorDataRegisters, // Holding registers to store sensor data
  coils: {},
  discrete: {},
  inputs: {},
}, {
  host: "0.0.0.0",
  port: process.env.MODBUS_PORT || 1234, // Port to listen on
}, () => {
  logger.info(`Modbus TCP Server is running on port ${process.env.MODBUS_PORT || 1234}`);
});

// Handle Modbus Write Multiple Holding Registers (Function Code 16)
server.on("writeMultipleRegisters", function (request, res) {
  const address = request.address;
  const values = request.values;

  logger.info(`Received write request: Address ${address}, Values: ${values}`);

  // Update holding registers (real sensor data)
  values.forEach((value, index) => {
    const registerAddress = address + index;
    if (sensorDataRegisters.hasOwnProperty(registerAddress)) {
      sensorDataRegisters[registerAddress] = value;
      logger.info(`Updated register ${registerAddress} with value: ${value}`);
    } else {
      logger.warn(`Invalid register address: ${registerAddress}`);
    }
  });

  res(); // Send response back to the client (RTU)
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

  // Handle Login and Heartbeat Messages
  socket.on("data", (data) => {
    const message = data.toString().trim();
    logger.info(`Received message from client: ${message}`);

    if (message === "Q2685SY008TX9765") { // Login message from RTU
      logger.info("Login message received");
      socket.write(""); // Respond with a blank acknowledgment (empty response)
      logger.info("Sent blank acknowledgment for login message");
    } else if (message === "Q") { // Heartbeat message from RTU
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

// Start TCP Server for Login and Heartbeat Messages
tcpServer.listen(process.env.MODBUS_PORT || 1234, () => {
  logger.info(`TCP Server for heartbeat and login messages is running on port ${process.env.MODBUS_PORT || 1234}`);
});

// Handle Modbus Server Errors
server.on("error", (err) => {
  logger.error(`Modbus server error: ${err.message}`);
});
