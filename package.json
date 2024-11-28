// Import required modules
const ModbusRTU = require("modbus-serial");
const net = require("net");
const { MongoClient } = require("mongodb");
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

// MongoDB Connection Setup
const client = new MongoClient('mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let sensorDataCollection;

client.connect()
  .then(() => {
    logger.info("Connected to MongoDB");
    const db = client.db(); // Use the default database from URI
    sensorDataCollection = db.collection("sensorData");
  })
  .catch((err) => logger.error(`MongoDB Connection Error: ${err.message}`));

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

  // Save to MongoDB for other register writes
  sensorDataCollection.insertOne({
    registerAddress: registerAddress,
    value: registerValue,
    timestamp: new Date(),
  })
    .then(() => logger.info(`Sensor data saved: Address - ${registerAddress}, Value - ${registerValue}`))
    .catch((err) => logger.error(`Error saving sensor data: ${err.message}`));

  res(); // Send response back to the client (S275)
});

// Handle Write Multiple Registers (Function Code 16)
server.on("writeMultipleRegisters", function (request, res) {
  const address = request.address;
  const values = request.values;

  logger.info(`Received multiple register values starting from address ${address} with values: ${values}`);

  // Save to MongoDB for each register
  const documents = values.map((value, index) => ({
    registerAddress: address + index,
    value: value,
    timestamp: new Date(),
  }));

  sensorDataCollection.insertMany(documents)
    .then(() => logger.info(`Sensor data saved for multiple addresses starting from ${address}`))
    .catch((err) => logger.error(`Error saving sensor data: ${err.message}`));

  res(); // Send response back to the client (S275)
});

// Handle Read Holding Registers (Function Code 03)
server.on("readHoldingRegisters", function (request, res) {
  const address = request.address;
  const length = request.quantity;

  logger.info(`Received read request for ${length} registers starting from address ${address}`);

  // Fetch values from MongoDB
  sensorDataCollection.find({ registerAddress: { $gte: address, $lt: address + length } }).toArray()
    .then((data) => {
      const values = Array(length).fill(0);
      data.forEach((entry) => {
        const index = entry.registerAddress - address;
        if (index >= 0 && index < length) {
          values[index] = entry.value;
        }
      });

      // Handle 32-bit register data
      const responseValues = [];
      for (let i = 0; i < length; i += 2) {
        if (i + 1 < length) {
          // Combine two 16-bit registers into one 32-bit value
          const high = values[i];
          const low = values[i + 1];
          const combinedValue = (high << 16) | low;
          responseValues.push(combinedValue);
        } else {
          // If there's an odd number of registers, just add the last value as is
          responseValues.push(values[i]);
        }
      }

      res.response.body.values = responseValues;
    })
    .catch((err) => {
      logger.error(`Error reading sensor data: ${err.message}`);
      res(); // Respond with empty values in case of error
    });
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
  logger.info("TCP Client connected");

  // Handle Login Message
  socket.on("data", (data) => {
    const message = data.toString().trim();
    logger.info(`Received message from client: ${message}`);

    if (message === "LOGIN") {
      logger.info("Login message received");
      socket.write("LOGIN_ACK"); // Respond with login acknowledgment
    } else if (message === "A") { // Handle Heartbeat Message from S275
      logger.info("Heartbeat message received");
      socket.write("A_ACK"); // Respond with Heartbeat ACK
      resetHeartbeatTimeout();
      socket.write("A"); // Respond with Heartbeat ACK
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
tcpServer.listen(process.env.TCP_PORT || 1234, () => {
  logger.info(`TCP Server for heartbeat and login messages is running on port ${process.env.TCP_PORT || 1234}`);
});

// Handle Errors
server.on("error", (err) => {
  logger.error(`Modbus server error: ${err.message}`);
});
