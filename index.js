const express = require("express");
const ModbusRTU = require("modbus-serial");

// Create an Express application
const app = express();

// Set up the Modbus server as the RTU client will push data
const modbusServer = new ModbusRTU();

// Define the register addresses for AINs and initialize values
const registers = {
    0: 0,   // AIN0
    2: 0,   // AIN1
    4: 0,   // AIN2
    6: 0,   // AIN3
    8: 0,   // AIN4
    10: 0,  // AIN5
};

// Function to update register values
function updateRegister(registerAddress, value) {
    if (registers.hasOwnProperty(registerAddress)) {
        registers[registerAddress] = value / 100; // Convert to real-world value
    } else {
        console.warn(`Invalid register address: ${registerAddress}`);
    }
}

// Start the Modbus TCP server to receive RTU client requests
const PORT = 1234;
const HOST = "0.0.0.0"; // Bind to all network interfaces

modbusServer.bindTCP({ port: PORT, host: HOST }, () => {
    console.log(`Modbus TCP server listening on ${HOST}:${PORT}`);
});

// Handle incoming requests from RTU
modbusServer.on("request", (request, response) => {
    console.log(`Received request from RTU`);
    try {
        const { functionCode, address, data } = request;

        // Function code 4: Read Input Registers
        if (functionCode === 4) {
            const startAddress = address;
            const quantity = data.length / 2; // Assuming 16-bit registers

            // Prepare a response buffer
            const buffer = Buffer.alloc(quantity * 2);
            for (let i = 0; i < quantity; i++) {
                const value = registers[startAddress + i * 2] || 0; // Default to 0
                buffer.writeInt16BE(value, i * 2);
            }
            response.send(buffer);
        } else {
            console.error(`Unsupported function code: ${functionCode}`);
        }
    } catch (error) {
        console.error(`Error processing request: ${error.message}`);
    }
});

// Handle RTU disconnects or errors
modbusServer.on("error", (err) => {
    console.error(`Modbus server error: ${err.message}`);
});

// Start HTTP server for additional diagnostics if needed
const httpPort = process.env.PORT || 10000;
app.get("/", (req, res) => {
    res.send("Modbus TCP server is running.");
});
app.listen(httpPort, () => {
    console.log(`HTTP server running on port ${httpPort}`);
});
