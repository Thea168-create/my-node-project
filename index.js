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
    0x0000: 12300,  // Register 0x0000 (Input Register 1)
    0x0002: 45600,  // Register 0x0002 (Input Register 2)
    0x0004: 78900,  // Register 0x0004 (Input Register 3)
    0x0006: 10100,  // Register 0x0006 (Input Register 4)
    0x0008: 11200,  // Register 0x0008 (Input Register 5)
    0x000A: 13100,  // Register 0x000A (Input Register 6)
  },
};

// Update simulated sensor values periodically
setInterval(() => {
  for (const unitID in registers) {
    for (const address in registers[unitID]) {
      registers[unitID][address] += Math.floor(Math.random() * 200 - 100);  // Simulate data fluctuation
    }
  }
}, 5000);

// Create a Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    getInputRegister: async (addr, unitID) => {
      console.log(`Read Input Register at address ${addr} from unit ${unitID}`);
      const value = registers[unitID]?.[addr] || 0;  // Get the value from the registers object

      // Log the value being returned to the client (QModMaster)
      console.log(`Returning value: ${value} for address: ${addr} from unit: ${unitID}`);

      // Log the request to MongoDB
      const database = client.db("modbus_logs");
      const collection = database.collection("logs");
      const logEntry = {
        unitID,
        functionCode: 4, // Read Input Register
        address: addr,
        value,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),  // Get timestamp in Asia/Phnom_Penh timezone
      };
      await collection.insertOne(logEntry);

      return value;  // Return the value to the client (QModMaster)
    },

    getHoldingRegister: (addr, unitID) => {
      console.log(`Read Holding Register at address ${addr} from unit ${unitID}`);
      return Promise.resolve(0);  // No holding registers in this example, can be extended if needed
    },

    setRegister: (addr, value, unitID) => {
      console.log(`Write Register at address ${addr} with value ${value} from unit ${unitID}`);
      return Promise.resolve();  // Can be extended to handle write operations if needed
    },
  },
  {
    host: "0.0.0.0",  // Listen on all available interfaces
    port: 1234,       // Modbus TCP port
    debug: true,      // Enable debugging
  }
);

console.log("Modbus TCP Server is running on port 1234");

// MongoDB logging for errors and client connections
modbusServer.on("error", (error) => {
  console.error("Modbus Server Error:", error);
});
