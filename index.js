const net = require("net");
const { MongoClient, ServerApiVersion } = require("mongodb");

const mongoURI = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(mongoURI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
let db;

async function connectToDatabase() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. Connected successfully.");
        db = client.db("modbus_logs");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1); // Exit the process if connection fails
    }
}
connectToDatabase();

// TCP server setup
const server = net.createServer((socket) => {
    console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on("data", async (data) => {
        try {
            console.log(`Received data: ${data.toString("hex")}`);
            const unitID = data.readUInt8(0);
            const functionCode = data.readUInt8(1);
            const startAddress = data.readUInt16BE(2);
            const quantity = data.readUInt16BE(4);

            if (functionCode === 0x04) {
                const response = Buffer.alloc(3 + quantity * 2);
                response.writeUInt8(unitID, 0);
                response.writeUInt8(functionCode, 1);
                response.writeUInt8(quantity * 2, 2);

                for (let i = 0; i < quantity; i++) {
                    response.writeUInt16BE(0, 3 + i * 2); // Replace 0 with actual register value
                }

                console.log(`Responding with: ${response.toString("hex")}`);
                socket.write(response);

                if (db) {
                    await db.collection("logs").insertOne({
                        timestamp: new Date(),
                        unitID,
                        startAddress,
                        quantity,
                        values: response.toString("hex"),
                    });
                    console.log("Data logged to MongoDB");
                } else {
                    console.error("Database connection not initialized.");
                }
            } else {
                console.error(`Unsupported Function Code: ${functionCode}`);
            }
        } catch (error) {
            console.error("Error processing data:", error);
        }
    });

    socket.on("close", () => console.log("Client disconnected"));
    socket.on("error", (error) => console.error("Socket error:", error.message));
});

server.listen(1234, "0.0.0.0", () => {
    console.log("Modbus TCP server running on port 1234");
});

process.on("SIGINT", async () => {
    console.log("Shutting down server...");
    await client.close();
    process.exit(0);
});
