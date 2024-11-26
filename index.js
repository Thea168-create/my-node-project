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
    0x0000: 12300,      // Low 16 bits
    0x0002: 20000,      // High 16 bits
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
    // Handling Input Register (32-bit using two 16-bit registers)
    getInputRegister: async (addr, unitID) => {
      console.log(`Read Input Register at address ${addr} from unit ${unitID}`);
      
      let value = 0;
      if (addr === 0x0000) {  // If address is 0x0000, combine low and high 16-bit values
        const low = registers[unitID]?.[addr] || 0;
        const high = registers[unitID]?.[addr + 2] || 0;
        value = (high << 16) + low;  // Combine high and low to form a 32-bit value
      } else {
        value = registers[unitID]?.[addr] || 0;
      }

      // Clamp the value to a maximum of 1,000,000 (adjust for range)
      value = Math.max(0, Math.min(1000000, value));  // Cap the value at 1,000,000 for large numbers

      // Log the value being returned to the terminal
      console.log(`Returning clamped value: ${value} for address: ${addr} from unit: ${unitID}`);

      // Log the request to MongoDB
      const database = client.db("modbus_logs");
      const collection = database.collection("logs");
      const logEntry = {
        unitID,
        functionCode: 4,  // Read Input Register
        address: addr,
        value,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),  // Timestamp for the request
      };
      await collection.insertOne(logEntry);

      return value;  // Return the clamped value back to QModMaster
    },

    // Handling Holding Register (if needed)
    getHoldingRegister: (addr, unitID) => {
      console.log(`Read Holding Register at address ${addr} from unit ${unitID}`);
      return Promise.resolve(0);  // No holding registers in this example, can be extended if needed
    },

    // Handling Register Write (if needed)
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
