const ModbusRTU = require("modbus-serial");
const { MongoClient } = require("mongodb");
const moment = require("moment-timezone");

// MongoDB connection URI
const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Modbus Register Values (for example)
const registers = {
  1: { 0x0000: 1234 }, // Make sure this value is non-zero to verify
};

// Modbus TCP server setup
const modbusServer = new ModbusRTU.ServerTCP(
  {
    getHoldingRegister: async (addr, unitID) => {
      const value = registers[unitID]?.[addr] || 0;
      console.log(`Request: Unit ${unitID}, Address ${addr}, Value: ${value}`); // Log the register value being read
      return value;
    },
    setRegister: (addr, value, unitID) => {
      console.log(`Write Request: Unit ${unitID}, Address ${addr}, Value: ${value}`); // Log write request
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

console.log("Modbus TCP Server is running on port 1234");

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
