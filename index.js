const net = require('net');  // Native Node.js module for TCP
const { MongoClient } = require("mongodb"); // MongoDB client to log requests

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

// Expected ASCII login message format
const validLoginMessageAscii = "LOGIN:S275_DEVICE_ID";  // ASCII login message format

// Simulated registers (for testing)
const registers = {
  1: {
    20000: 12345,  // Register 20000 value
    20001: 67890,  // Register 20001 value
    20002: 13579,  // Register 20002 value
    20003: 24680,  // Register 20003 value
  },
};

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
    console.log(`Received data from client: ${data.toString('hex')}`);

    // Check for login message in ASCII format (e.g., "LOGIN:S275_DEVICE_ID")
    if (!isAuthenticated) {
      const loginMessage = data.toString().trim();
      if (loginMessage === validLoginMessageAscii) {
        isAuthenticated = true;
        console.log('Device authenticated');
        // Send Login ACK Message (respond with the configured Login ACK message)
        const loginAckMessage = "LOGIN OK\n"; // Login acknowledgment message in ASCII
        socket.write(loginAckMessage);  // Send acknowledgment
        console.log('Sent Login ACK Message in ASCII');
      } else {
        console.log('Unauthorized device attempted to connect');
        socket.write("LOGIN FAILED\n");
        socket.end();  // Close connection if authentication fails
      }
    } else {
      // Log the incoming Modbus request in detail
      console.log('After login, checking for Modbus requests...');

      // Handle Modbus Read Holding Registers request (function code 3)
      if (data[0] === 0x01 && data[1] === 0x03) {  // Check for Modbus Read Holding Registers (function code 03)
        const startAddr = (data[2] << 8) | data[3];  // Starting address (big-endian)
        const numRegisters = (data[4] << 8) | data[5]; // Number of registers to read (big-endian)

        console.log(`Received Modbus request: Read Holding Registers starting at address ${startAddr}`);

        // Prepare Modbus response
        let response = Buffer.alloc(5 + numRegisters * 2);  // Function code + byte count + data
        response[0] = 0x01;  // Slave address (same as the device)
        response[1] = 0x03;  // Function code: 3 (Read Holding Registers)
        response[2] = numRegisters * 2;  // Byte count (each register is 2 bytes)
        
        // Add register values (using the start address and number of registers requested)
        let offset = 3;
        for (let i = 0; i < numRegisters; i++) {
          const regAddr = startAddr + i;

          const value = registers[1]?.[regAddr] || 0;  // Read from the register data

          response[offset++] = (value >> 8) & 0xFF;  // High byte
          response[offset++] = value & 0xFF;         // Low byte
        }

        console.log(`Returning Modbus values: ${response.toString('hex')} for starting address: ${startAddr}`);
        socket.write(response);  // Send the Modbus response

        // Optionally log the request/response to MongoDB
        const database = client.db("modbus_logs");
        const collection = database.collection("logs");
        const logEntry = {
          unitID: 1,
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
        console.log('Unsupported Modbus function code or invalid request format');
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
