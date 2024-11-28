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

// Expected login message and response (e.g., device authentication)
const validLoginMessage = "LOGIN:S275_DEVICE_ID";  // Example login message
const heartbeatTimeout = 70000;  // 70 seconds timeout for heartbeat

// Modbus register data for 6 analog sensors (16-bit values)
const registers = {
  1: {
    20000: 12345,  // Sensor 1 (16-bit)
    20001: 67890,  // Sensor 2 (16-bit)
    20002: 13579,  // Sensor 3 (16-bit)
    20003: 24680,  // Sensor 4 (16-bit)
    20004: 11223,  // Sensor 5 (16-bit)
    20005: 45678,  // Sensor 6 (16-bit)
  },
};

// Flag to check authentication
let isAuthenticated = false;
let heartbeatTimeoutHandle;

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

// Handle login and heartbeat
modbusServer.on("connection", (socket) => {
  let isAuthenticated = false;
  let heartbeatTimeoutHandle;

  socket.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`Received data from client: ${message}`);

    // Handle login message (device authentication)
    if (!isAuthenticated && message.startsWith("LOGIN")) {
      if (message === validLoginMessage) {
        isAuthenticated = true;
        console.log('Device authenticated');
        socket.write("LOGIN OK\n");  // Send login ACK
      } else {
        console.log('Unauthorized device attempted to connect');
        socket.write("LOGIN FAILED\n");
        socket.end(); // Disconnect unauthorized device
      }
    }
    
    // Handle heartbeat message (device sends "A", server responds with "R")
    if (isAuthenticated && message === "A") {
      console.log('Received Heartbeat Message: A');
      socket.write("R");  // Send Heartbeat ACK
      console.log('Sent Heartbeat ACK Message: R');

      // Reset heartbeat timeout on every valid heartbeat
      clearTimeout(heartbeatTimeoutHandle);
      heartbeatTimeoutHandle = setTimeout(() => {
        console.log("No heartbeat received, disconnecting...");
        socket.end(); // Disconnect if no heartbeat is received within the timeout period
      }, heartbeatTimeout);
    }
  });

  // Handle client disconnect
  socket.on('end', () => {
    console.log('Client disconnected');
    clearTimeout(heartbeatTimeoutHandle);  // Clear heartbeat timeout on disconnection
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error(`Error with client: ${err.message}`);
    clearTimeout(heartbeatTimeoutHandle);  // Clear heartbeat timeout on error
  });
});
