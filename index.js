const ModbusRTU = require("modbus-serial");
const { MongoClient } = require("mongodb");
const net = require('net');

// MongoDB connection URI
const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

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

// Expected login message and response (e.g., device authentication)
const validLoginMessage = "LOGIN:S275_DEVICE_ID";
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

// Create Modbus TCP server
const server = new ModbusRTU.ServerTCP(502, { 
  unitId: 1  // Modbus Slave ID
});

// Modbus function to handle the read holding registers (Function Code 3)
server.on('readHoldingRegisters', function(request, response) {
  if (!isAuthenticated) {
    console.log('Device not authenticated yet.');
    response.sendException(0x02); // Send exception for unauthorized request
    return;
  }

  // Process register reading based on the request
  const startAddress = request.address;
  const count = request.count;

  console.log(`Reading Holding Registers starting from address ${startAddress}`);

  // Prepare the data to send back based on the starting address and count
  const data = [];
  for (let i = 0; i < count; i++) {
    const registerValue = registers[1]?.[startAddress + i] || 0;
    data.push(registerValue);
  }

  response.send(data);
});

// Create TCP server for handling login and heartbeat messages
const tcpServer = net.createServer((socket) => {
  let clientIP = socket.remoteAddress;
  let clientPort = socket.remotePort;

  console.log(`New client connected: ${clientIP}:${clientPort}`);

  // Handle incoming data
  socket.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`Received data from client: ${message}`);

    // Handle login message (device authentication)
    if (!isAuthenticated && message.startsWith("LOGIN")) {
      if (message === validLoginMessage) {
        isAuthenticated = true;
        console.log('Device authenticated');
        socket.write("LOGIN OK\n"); // Send login ACK
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
    console.log(`Client disconnected: ${clientIP}:${clientPort}`);
    clearTimeout(heartbeatTimeoutHandle);  // Clear heartbeat timeout on disconnection
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error(`Error with client ${clientIP}:${clientPort} - ${err.message}`);
    clearTimeout(heartbeatTimeoutHandle);  // Clear heartbeat timeout on error
  });
});

// Start TCP server on port 1234 for login and heartbeat handling
tcpServer.listen(1234, () => {
  console.log("TCP Server for login and heartbeat listening on port 1234");
});

// Start Modbus TCP server to handle actual Modbus communication on port 502
server.listen(() => {
  console.log("Modbus TCP server listening on port 502");
});
