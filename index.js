const ModbusRTU = require("modbus-serial");
const { MongoClient } = require("mongodb");
const moment = require("moment-timezone");

// MongoDB connection URI
const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Modbus Register Values (example)
const registers = {
  1: { 0x0000: 1234 }, // Make sure the value is correctly set here
};

// Modbus TCP server setup
const modbusServer = new ModbusRTU.ServerTCP(
  {
    getHoldingRegister: async (addr, unitID) => {
      const value = registers[unitID]?.[addr] || 0;
      console.log(`Request: Unit ${unitID}, Address ${addr}, Value: ${value}`);
      return value;
    },
    setRegister: (addr, value, unitID) => {
      console.log(`Write Request: Unit ${unitID}, Address ${addr}, Value: ${value}`);
      registers[unitID][addr] = value; // Update register value
      return Promise.resolve();
    }
  },
  {
    host: "0.0.0.0",
    port: 1234, // Modbus TCP port
    debug: true,
  }
);

modbusServer.on("connection", (socket) => {
  console.log("RTU connected: ", socket.remoteAddress);

  // Handle Login Message and Respond with ACK
  socket.on("data", (data) => {
    if (data.toString("hex").startsWith("0103")) { // Example: checking if login message received
      console.log("Login message received");

      // Example response with the correct ACK message
      const ackMessage = Buffer.from([0x01, 0x03, 0x02, 0x00, 0x01]); // Responding with ACK
      socket.write(ackMessage);
      console.log("Sent login ACK");
    }
  });
});

modbusServer.listen(1234, () => {
  console.log("Modbus TCP Server is running on port 1234");
});

// MongoDB logging for errors and client connections
modbusServer.on("data", (data) => {
  console.log("Received Modbus Data:", data);
  const logEntry = {
    data,
    timestamp: moment().tz("Asia/Phnom_Penh").format(),
  };
  const database = client.db("modbus_logs");
  const collection = database.collection("logs");
  collection.insertOne(logEntry);
});
