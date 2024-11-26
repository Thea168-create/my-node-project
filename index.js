const net = require("net");

// Create a TCP server
const server = net.createServer((socket) => {
  console.log(`RTU connected: ${socket.remoteAddress}:${socket.remotePort}`);

  // Handle incoming data
  socket.on("data", (data) => {
    console.log(`Received raw data from RTU: ${data.toString("hex")}`);

    // Parse the raw data into meaningful values
    const parsedData = parseRawData(data);
    console.log("Parsed Data:", parsedData);

    // Optionally save the parsed data to a database
    // saveToDatabase(parsedData);
  });

  // Handle client disconnection
  socket.on("close", () => {
    console.log(`RTU disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
  });

  // Handle socket errors
  socket.on("error", (error) => {
    console.error(`Socket error: ${error.message}`);
  });
});

// Function to parse raw data (example)
function parseRawData(data) {
  const values = [];
  // Example: Parse data as 16-bit integers (big-endian)
  for (let i = 0; i < data.length; i += 2) {
    values.push(data.readUInt16BE(i));
  }
  return values;
}

// Start the server
const PORT = 1234; // Use the port configured on your RTU
server.listen(PORT, "0.0.0.0", () => {
  console.log(`TCP server running on port ${PORT}`);
});
