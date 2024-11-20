const ModbusServer = require("modbus-serial").ServerTCP;

// Simulated modular register mapping for multiple RTUs
const registers = {
    1: { // RTU with Unit ID 1
        0x0000: 12300,
        0x0002: 45600,
        0x0004: 78900,
        0x0006: 10100,
        0x0008: 11200,
        0x000A: 13100,
    },
    2: { // RTU with Unit ID 2
        0x0000: 54321,
        0x0002: 98765,
        0x0004: 22222,
        0x0006: 44444,
        0x0008: 55555,
        0x000A: 66666,
    },
};

// Update sensor values periodically to simulate real-time changes
setInterval(() => {
    for (const unitID in registers) {
        for (const address in registers[unitID]) {
            registers[unitID][address] += Math.floor(Math.random() * 200 - 100); // Add random variation
        }
    }
}, 5000);

// Create a Modbus TCP server
const server = new ModbusServer({
    host: "0.0.0.0", // Listen on all interfaces
    port: 1234,      // Modbus TCP port
    debug: true,     // Enable debugging output
});

// Handle Modbus requests for reading input registers (Function Code 4)
server.on("read-input-registers", (request, callback) => {
    const unitID = request.unitID; // Extract unit ID
    const startAddress = request.startAddress;
    const quantity = request.quantity;

    console.log(
        `Received request from Unit ID ${unitID}: Start Address ${startAddress}, Quantity ${quantity}`
    );

    if (registers[unitID]) { // Check if unit ID exists
        const response = [];
        for (let i = 0; i < quantity; i++) {
            const address = startAddress + i * 2; // Compute address for each register
            const value = registers[unitID][address] || 0; // Return default value if address is missing
            response.push(Math.floor(value / 65536)); // High word
            response.push(value % 65536); // Low word
        }
        console.log(`Responding to Unit ID ${unitID} with data: ${response}`);
        callback(null, response); // Send response
    } else {
        console.error(`Unknown Unit ID: ${unitID}`);
        callback({ code: 2 }); // Modbus exception code 2 (Illegal Data Address)
    }
});

// Start the server
server.listen(() => {
    console.log("Modbus TCP server is running at 0.0.0.0:1234");
});
