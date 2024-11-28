const ModbusRTU = require("modbus-serial");
const { MongoClient } = require("mongodb");
const moment = require("moment-timezone");

const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB connection setup
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

// Register data for 6 analog sensors (AIN0 to AIN5) - 32-bit values (ABCD)
// Adjusted for two devices with unique addresses starting from 20128
const registers = {
  1: {  // Device 1 (Slave Address 1)
    20128: 12300,  // AIN0 low register
    20129: 45600,  // AIN0 high register
    20130: 78900,  // AIN1 low register
    20131: 10100,  // AIN1 high register
    20132: 11200,  // AIN2 low register
    20133: 13100,  // AIN2 high register
    20134: 11200,  // AIN3 low register
    20135: 14100,  // AIN3 high register
    20136: 15200,  // AIN4 low register
    20137: 16100,  // AIN4 high register
    20138: 17100,  // AIN5 low register
    20139: 18100,  // AIN5 high register
  },
  2: {  // Device 2 (Slave Address 2)
    20140: 20200,  // AIN0 low register
    20141: 20300,  // AIN0 high register
    20142: 20400,  // AIN1 low register
    20143: 20500,  // AIN1 high register
    20144: 20600,  // AIN2 low register
    20145: 20700,  // AIN2 high register
    20146: 20800,  // AIN3 low register
    20147: 20900,  // AIN3 high register
    20148: 21000,  // AIN4 low register
    20149: 21100,  // AIN4 high register
    20150: 21200,  // AIN5 low register
    20151: 21300,  // AIN5 high register
  },
};

// Create Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    // Handling the reading of holding registers (AIN0 to AIN5)
    getHoldingRegister: async (addr, unitID, numRegisters) => {
      console.log(`Read Holding Registers starting at address ${addr} from unit ${unitID}`);

      let values = [];

      // Loop through the number of registers to read and return their values
      for (let i = 0; i < numRegisters; i++) {
        const lowAddr = addr + (i * 2);      // Address of the low register (16-bit)
        const highAddr = lowAddr + 1;        // Address of the high register (16-bit)

        // Reading the low and high registers (16-bit) for each AIN (32-bit)
        const lowValue = registers[unitID]?.[lowAddr] || 0;
        const highValue = registers[unitID]?.[highAddr] || 0;

        // Combine low and high registers into a 32-bit value (ABCD format)
        let value = (highValue << 16) | lowValue; // Combine high and low bytes into 32-bit

        // Optional: clamp the value to a specific range
        value = Math.max(0, Math.min(1000000, value));

        values.push(value);  // Add the 32-bit value to the array of results
      }

      console.log(`Returning values: ${values} for starting address: ${addr}`);

      // Log the request and values to MongoDB
      const database = client.db("modbus_logs");
      const collection = database.collection("logs");
      const logEntry = {
        unitID,
        functionCode: 3,  // Read Holding Register
        address: addr,
        values,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),  // Timestamp of request
      };
      await collection.insertOne(logEntry); // Insert the log into MongoDB

      return values;  // Return the values to the Modbus client
    },

    // New event listener for when a client connects to the server
    onConnection: (socket) => {
      const clientIP = socket.remoteAddress;  // Get the client's IP address
      const clientPort = socket.remotePort;  // Get the client's port
      console.log(`New client connected: ${clientIP}:${clientPort}`);
    }
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
