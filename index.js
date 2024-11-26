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

// Register data for 6 analog sensors (AIN0 to AIN5)
const registers = {
  1: {
    0: 12300,  // AIN0 at address 0 (decimal)
    2: 45600,  // AIN1 at address 2 (decimal)
    4: 78900,  // AIN2 at address 4 (decimal)
    6: 10100,  // AIN3 at address 6 (decimal)
    8: 11200,  // AIN4 at address 8 (decimal)
    10: 13100, // AIN5 at address 10 (decimal)
  },
};

// Create Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    // Handling the reading of input registers
    getInputRegister: async (addr, unitID) => {
      console.log(`Read Input Register at address ${addr} from unit ${unitID}`);

      let value = 0;

      // Handle two 16-bit registers combined for each sensor (if needed)
      if (addr % 2 === 0) {  // Even address (low byte)
        const low = registers[unitID]?.[addr] || 0;  // Low byte
        const high = registers[unitID]?.[addr + 1] || 0;  // High byte
        value = (high << 16) + low;  // Combine high and low bytes into a 32-bit value
      } else {
        value = registers[unitID]?.[addr] || 0;  // For odd addresses, return the value directly
      }

      // Clamp the value to a maximum of 1,000,000 to prevent overflow or unrealistic values
      value = Math.max(0, Math.min(1000000, value));

      // Log the value being returned to the terminal
      console.log(`Returning value: ${value} for address: ${addr}`);

      // Log the request and value to MongoDB
      const database = client.db("modbus_logs");
      const collection = database.collection("logs");
      const logEntry = {
        unitID,
        functionCode: 4,  // Read Input Register
        address: addr,
        value,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),  // Timestamp of request
      };
      await collection.insertOne(logEntry); // Insert the log into MongoDB

      return value;  // Return the value back to the Modbus TCP client
    },

    // Handling any write requests (though we’re only focusing on reading)
    setRegister: (addr, value, unitID) => {
      console.log(`Write Register at address ${addr} with value ${value} from unit ${unitID}`);
      return Promise.resolve(); // We’re not handling writes in this example
    },
  },
  {
    host: "0.0.0.0",  // Listen on all available interfaces
    port: 1234,       // Modbus TCP port
    debug: true,      // Enable debugging (optional)
  }
);

console.log("Modbus TCP Server is running on port 1234");

// MongoDB logging for errors
modbusServer.on("error", (error) => {
  console.error("Modbus Server Error:", error);
});
