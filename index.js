const express = require("express");
const net = require("net");

const app = express();
const HTTP_PORT = process.env.PORT || 10000; // For Render health check
const MODBUS_PORT = 1234; // Port where RTU will send data

// Start Express server (for health checks or status monitoring)
app.get("/", (req, res) => {
    res.send("Modbus TCP server is running and waiting for RTU data!");
});

app.listen(HTTP_PORT, () => {
    console.log(`HTTP server running on port ${HTTP_PORT}`);
});

// Create a TCP server to handle RTU connections
const server = net.createServer((socket) => {
    console.log("RTU connected:", socket.remoteAddress, ":", socket.remotePort);

    // Handle incoming data from RTU
    socket.on("data", (data) => {
        console.log("Received data from RTU:", data.toString("hex"));
        // Parse the data here based on RTU's data format if needed
    });

    // Handle RTU disconnect
    socket.on("end", () => {
        console.log("RTU disconnected.");
    });

    // Handle errors
    socket.on("error", (err) => {
        console.error("Socket error:", err.message);
    });
});

// Start listening for RTU connections
server.listen(MODBUS_PORT, () => {
    console.log(`Modbus TCP server listening on port ${MODBUS_PORT}`);
});
