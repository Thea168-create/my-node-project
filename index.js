const ModbusRTU = require("modbus-serial");
const { MongoClient } = require("mongodb");
const moment = require("moment-timezone");

// MongoDB connection URI
const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Exit if the connection fails
  }
}
connectDB();

// Simulated register data for multiple RTUs
const registers = {
  1: {
    0x0000: 12300,
    0x0002: 45600,
    0x0004: 78900,
    0x0006: 10100,
    0x0008: 11200,
    0x000A: 13100,
  },
};

// Update simulated sensor values periodically
setInterval(() => {
  for (const unitID in registers) {
    for (const address in registers[unitID]) {
      registers[unitID][address] += Math.floor(Math.random() * 200 - 100);
    }
  }
}, 5000);

// Create a Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    getInputRegister: async (addr, unitID) => {
      console.log(`Read Input Register at address ${addr} from unit ${unitID}`);
      const value = registers[unitID]?.[addr] || 0;

      // Log the request to MongoDB
      const database = client.db("modbus_logs");
      const collection = database.collection("logs");
      const logEntry = {
        unitID,
        functionCode: 4, // Read Input Register
        address: addr,
        value,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),
      };
      await collection.insertOne(logEntry);

      return value;
    },
    getHoldingRegister: (addr, unitID) => {
      console.log(`Read Holding Register at address ${addr} from unit ${unitID}`);
      return Promise.resolve(0); // No holding registers in this example
    },
    setRegister: (addr, value, unitID) => {
      console.log(`Write Register at address ${addr} with value ${value} from unit ${unitID}`);
      return Promise.resolve();
    },
  },
  {
    host: "0.0.0.0",
    port: 1234, // Modbus TCP port
    debug: true,
  }
);

console.log("Modbus TCP Server is running on port 1234");

// MongoDB logging for errors and client connections
modbusServer.on("error", (error) => {
  console.error("Modbus Server Error:", error);
});
