const net = require('net');  // Native Node.js module for TCP

// Create a basic TCP server
const server = net.createServer((socket) => {
  const clientIP = socket.remoteAddress;
  const clientPort = socket.remotePort;

  // Log the connection details
  console.log(`New client connected: ${clientIP}:${clientPort}`);

  // Send a response to the client
  socket.write('Hello, client!\n');

  // Handle client disconnect
  socket.on('end', () => {
    console.log(`Client disconnected: ${clientIP}:${clientPort}`);
  });

  // Handle any errors
  socket.on('error', (err) => {
    console.error(`Error with client ${clientIP}:${clientPort} - ${err.message}`);
  });
});

// Server configuration: Listen on port 1234 for incoming TCP connections
const PORT = 1234;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
});
