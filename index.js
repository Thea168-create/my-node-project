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

// Simulate Device ID for login
const validDeviceID = "010303"; // Replace with the actual expected device ID

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
      console.log(`Modbus request received from ${clientIP}:${clientPort}`);
      // For simplicity, just sending a success response (we can handle Modbus here)
      socket.write("Modbus response: OK\n");
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
