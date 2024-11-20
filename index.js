const net = require("net");

// Simulated modular register mapping for multiple RTUs
const registers = {
    1: { 0x0000: 12300, 0x0002: 45600, 0x0004: 78900, 0x0006: 10100, 0x0008: 11200, 0x000A: 13100 },
    2: { 0x0000: 54321, 0x0002: 98765, 0x0004: 22222, 0x0006: 44444, 0x0008: 55555, 0x000A: 66666 },
};
const MAX_REGISTER_ADDRESS = 0x000A;

// Update sensor values periodically
setInterval(() => {
    for (const unitID in registers) {
        for (const address in registers[unitID]) {
            registers[unitID][address] = Math.max(
                0,
                Math.min(65535, registers[unitID][address] + Math.floor(Math.random() * 200 - 100))
            );
        }
    }
}, 5000);

// Create a TCP server
const server = net.createServer((socket) => {
    const clientAddress = socket.remoteAddress;
    const clientPort = socket.remotePort;
    console.log(`Client connected: ${clientAddress}:${clientPort}`);

    socket.on("data", (data) => {
        try {
            if (data.length < 5) {
                console.error("Malformed request: Insufficient data length");
                return;
            }
            const unitID = data.readUInt8(0);
            const functionCode = data.readUInt8(1);
            const startAddress = data.readUInt16BE(2);
            const quantity = data.readUInt16BE(4);

            if (startAddress + quantity * 2 > MAX_REGISTER_ADDRESS) {
                console.error(`Invalid address range: Start ${startAddress}, Quantity ${quantity}`);
                socket.write(Buffer.from([unitID, functionCode | 0x80, 0x02])); // Illegal Data Address
                return;
            }

            if (functionCode === 0x04) {
                const response = Buffer.alloc(3 + quantity * 2);
                response.writeUInt8(unitID, 0);
                response.writeUInt8(functionCode, 1);
                response.writeUInt8(quantity * 2, 2);

                for (let i = 0; i < quantity; i++) {
                    const address = startAddress + i * 2;
                    response.writeUInt16BE(registers[unitID]?.[address] || 0, 3 + i * 2);
                }

                socket.write(response);
            } else {
                console.error(`Unsupported Function Code: ${functionCode}`);
                socket.write(Buffer.from([unitID, functionCode | 0x80, 0x01])); // Illegal Function
            }
        } catch (error) {
            console.error(`Error processing request: ${error.message}`);
        }
    });

    socket.on("close", () => {
        console.log(`Client disconnected: ${clientAddress}:${clientPort}`);
    });

    socket.on("error", (error) => {
        console.error(`Socket error: ${error.message}`);
    });
});

server.listen(1234, "0.0.0.0", () => {
    console.log("Modbus TCP server running on port 1234");
});
