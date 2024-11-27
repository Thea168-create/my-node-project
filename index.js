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

// Pre-configured device credentials (e.g., Device ID)
const deviceCredentials = {
  "Q2685SY008TX9765": true,  // Example device ID
  "device2": true,            // Another example device
};

// Variable to track whether the device is authenticated
let deviceAuthenticated = false;

// Register data for 6 analog sensors (AIN0 to AIN5) - 32-bit values (ABCD)
const registers = {
  1: {
    0: 12300,  // AIN0 low register (address 0)
    2: 45600,  // AIN0 high register (address 2)
    4: 78900,  // AIN1 low register (address 4)
    6: 10100,  // AIN1 high register (address 6)
    8: 11200,  // AIN2 low register (address 8)
    10: 13100, // AIN2 high register (address 10)
    12: 11200, // AIN3 low register (address 12)
    14: 14100, // AIN3 high register (address 14)
    16: 15200, // AIN4 low register (address 16)
    18: 16100, // AIN4 high register (address 18)
    20: 17100, // AIN5 low register (address 20)
    22: 18100, // AIN5 high register (address 22)
  },
};

// Create Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    // Handling the reading of input registers (AIN0 to AIN5)
    getInputRegister: async (addr, unitID, numRegisters) => {
      console.log(`Read Input Registers starting at address ${addr} from unit ${unitID}`);

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
        functionCode: 4,  // Read Input Register
        address: addr,
        values,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),  // Timestamp of request
      };
      await collection.insertOne(logEntry); // Insert the log into MongoDB

      return values;  // Return an array of 32-bit values back to the Modbus TCP client
    },

    // Listen for login messages and authenticate
    read: (unitID, data) => {
      // Convert the incoming data to a string (assuming it's ASCII)
      const loginMessage = data.toString();  // This should be an ASCII string

      console.log("Received Login Message:", loginMessage); // For debugging

      // Example: Login message format: "LOGIN:Q2685SY008TX9765"
      if (loginMessage.startsWith("LOGIN")) {
        const deviceID = loginMessage.split(":")[1]; // Extract device ID from the message
        
        // Validate device ID
        if (deviceCredentials[deviceID]) {
          console.log(`Device ${deviceID} authenticated successfully`);
          deviceAuthenticated = true;  // Mark the device as authenticated
        } else {
          console.log(`Authentication failed for device ${deviceID}`);
          deviceAuthenticated = false;
        }
      }
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
