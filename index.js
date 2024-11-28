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

// Register data for testing (AIN0)
const registers = {
  1: {  // Device 1 (Slave Address 1)
    20128: 12300,  // AIN0 low register
    20129: 45600,  // AIN0 high register
  },
};

// Create TCP Server using `net` module
const server = net.createServer((socket) => {
  const clientIP = socket.remoteAddress;
  const clientPort = socket.remotePort;
  
  // Log the client connection
  console.log(`New client connected: ${clientIP}:${clientPort}`);
  
  // Handle incoming data (Modbus request)
  socket.on('data', (data) => {
    console.log(`Received data from client: ${data}`);

    // Simulate processing Modbus request
    if (data[0] === 0x03) {  // Function code 3: Read Holding Registers
      const unitID = data[0]; // Slave address
      const startAddr = (data[2] << 8) | data[3]; // Starting address (big-endian)
      const numRegisters = (data[4] << 8) | data[5]; // Number of registers to read (big-endian)
      
      // Prepare the response (Read Holding Registers)
      let response = Buffer.alloc(5 + numRegisters * 2);  // Function code + byte count + data
      response[0] = unitID;  // Slave address
      response[1] = 0x03;    // Function code: 3 (Read Holding Registers)
      response[2] = numRegisters * 2;  // Byte count (each register is 2 bytes)
      
      // Add data values
      let offset = 3;
      for (let i = 0; i < numRegisters; i++) {
        const lowAddr = startAddr + (i * 2);
        const highAddr = lowAddr + 1;
        
        const lowValue = registers[unitID]?.[lowAddr] || 0;
        const highValue = registers[unitID]?.[highAddr] || 0;

        // Combine the low and high register values into the response
        response[offset++] = (lowValue >> 8) & 0xFF;
        response[offset++] = lowValue & 0xFF;
        response[offset++] = (highValue >> 8) & 0xFF;
        response[offset++] = highValue & 0xFF;
      }
      
      // Send the response back to the client
      socket.write(response);
      console.log(`Sent response to client: ${response}`);
    } else {
      console.log('Unsupported Modbus function code');
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
