const net = require('net');  // Native Node.js module for TCP
const { MongoClient } = require("mongodb");

// MongoDB connection URI
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

// Simple 16-bit register data for testing
const registers = {
  1: {  // Device 1 (Slave Address 1)
    20000: 12300,  // Register 20000 value (16-bit)
    20001: 45600,  // Register 20001 value (16-bit)
    20002: 78900,  // Register 20002 value (16-bit)
    20003: 10100,  // Register 20003 value (16-bit)
    20004: 11200,  // Register 20004 value (16-bit)
    20005: 13100,  // Register 20005 value (16-bit)
  },
};

// Simulate Device ID for login
const validDeviceID = "010303"; // Replace with actual expected device ID

// Create TCP Server using `net` module
const server = net.createServer((socket) => {
  const clientIP = socket.remoteAddress;
  const clientPort = socket.remotePort;
  
  // Log the client connection
  console.log(`New client connected: ${clientIP}:${clientPort}`);
  
  // Flag to track if login was successful
  let isAuthenticated = false;
  
  // Handle incoming data (Login first, then Modbus requests)
  socket.on('data', (data) => {
    // Check for login message (assuming it's ASCII formatted)
    const loginMessage = data.toString().trim();
    if (!isAuthenticated) {
      if (loginMessage.startsWith("LOGIN")) {
        const deviceID = loginMessage.split(":")[1]; // Extract Device ID from the login message
        if (deviceID === validDeviceID) {
          isAuthenticated = true;
          console.log(`Device authenticated: ${deviceID}`);
          socket.write("LOGIN OK\n");  // Send acknowledgment
        } else {
          socket.write("LOGIN FAILED\n");  // Reject unauthorized device
          console.log(`Unauthorized device attempted to connect: ${deviceID}`);
          socket.end();  // Close connection if authentication fails
        }
      }
    } else {
      // Process Modbus request after successful login
      if (data[0] === 0x03) {  // Function code 3: Read Holding Registers
        const unitID = data[0]; // Slave address
        const startAddr = (data[2] << 8) | data[3]; // Starting address (big-endian)
        const numRegisters = (data[4] << 8) | data[5]; // Number of registers to read (big-endian)
        
        console.log(`Read Holding Registers starting at address ${startAddr} from unit ${unitID}`);

        let response = Buffer.alloc(5 + numRegisters * 2);  // Function code + byte count + data
        response[0] = unitID;  // Slave address
        response[1] = 0x03;    // Function code: 3 (Read Holding Registers)
        response[2] = numRegisters * 2;  // Byte count (each register is 2 bytes)
        
        // Add data values (based on the address requested)
        let offset = 3;
        for (let i = 0; i < numRegisters; i++) {
          const regAddr = startAddr + i; // Register addresses start from 20000

          const value = registers[unitID]?.[regAddr] || 0;

          response[offset++] = (value >> 8) & 0xFF;  // High byte
          response[offset++] = value & 0xFF;         // Low byte
        }
        
        console.log(`Returning values: ${response.toString('hex')} for starting address: ${startAddr}`);
        socket.write(response);

        // Log the request and response to MongoDB
        const database = client.db("modbus_logs");
        const collection = database.collection("logs");
        const logEntry = {
          unitID,
          functionCode: 3,  // Read Holding Register
          address: startAddr,
          values: response.toString('hex'),
          timestamp: new Date().toISOString(),
        };
        collection.insertOne(logEntry).then(() => {
          console.log("Logged data to MongoDB:", logEntry);
        }).catch((error) => {
          console.error("Error logging to MongoDB:", error);
        });
      } else {
        console.log('Unsupported Modbus function code');
      }
    }
  });

  // Handle client disconnect
  socket.on('end', () => {
    console.log(`Client disconnected: ${clientIP}:${clientPort}`);
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error(`Error with client ${clientIP}:${clientPort} - ${err.message}`);
  });
});

// Listen on port 1234
const PORT = 1234;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
});
