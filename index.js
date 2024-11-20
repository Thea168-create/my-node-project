const net = require("net");
const { MongoClient } = require("mongodb");

// MongoDB connection setup
const mongoURI = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true";
const client = new MongoClient(mongoURI);
let db;

client.connect()
    .then(() => {
        db = client.db("modbus_logs"); // Use "modbus_logs" database
        console.log("Connected to MongoDB");
    })
    .catch((err) => console.error("MongoDB connection error:", err));

// Simulated modular register mapping for multiple RTUs
const registers = {
    1: { 0x0000: 12300, 0x0002: 45600, 0x0004: 78900 },
    2: { 0x0000: 54321, 0x0002: 98765, 0x0004: 22222 },
};

// TCP server setup
const server = net.createServer((socket) => {
    console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on("data", async (data) => {
        try {
            console.log(`Received data: ${data.toString("hex")}`);
            const unitID = data.readUInt8(0); // Unit ID
            const functionCode = data.readUInt8(1); // Function Code
            const startAddress = data.readUInt16BE(2); // Starting Address
            const quantity = data.readUInt16BE(4); // Number of Registers

            if (functionCode === 0x04 && registers[unitID]) {
                // Prepare response
                const response = Buffer.alloc(3 + quantity * 2);
                response.writeUInt8(unitID, 0); // Unit ID
                response.writeUInt8(functionCode, 1); // Function Code
                response.writeUInt8(quantity * 2, 2); // Byte Count

                for (let i = 0; i < quantity; i++) {
                    const address = startAddress + i * 2;
                    const value = registers[unitID][address] || 0;
                    response.writeUInt16BE(value, 3 + i * 2);
                }

                console.log(`Responding with: ${response.toString("hex")}`);
                socket.write(response);

                // Log data to MongoDB
                await db.collection("logs").insertOne({
                    timestamp: new Date(),
                    unitID,
                    startAddress,
                    quantity,
                    values: response.toString("hex"),
                });
                console.log("Data logged to MongoDB");
            } else {
                console.error(`Unsupported request: Function Code ${functionCode} or Unit ID ${unitID}`);
            }
        } catch (error) {
            console.error(`Error processing request: ${error.message}`);
        }
    });

    socket.on("close", () => console.log("Client disconnected"));
    socket.on("error", (error) => console.error("Socket error:", error.message));
});

server.listen(1234, "0.0.0.0", () => {
    console.log("Modbus TCP server running on port 1234");
});
