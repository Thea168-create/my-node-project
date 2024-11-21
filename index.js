const net = require("net");
const { MongoClient, ServerApiVersion } = require("mongodb"); // Import MongoDB client

// MongoDB connection URI (update with your credentials)
const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Exit the process if MongoDB connection fails
  }
}
connectDB();

// Simulated modular register mapping for multiple RTUs
const registers = {
  1: {
    0x0000: 12300,
    0x0002: 45600,
    0x0004: 78900,
    0x0006: 10100,
    0x0008: 11200,
    0x000A: 13100,
  },
  2: {
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

// Create a TCP server
const server = net.createServer((socket) => {
  console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on("data", async (data) => {
    try {
      console.log(`Received data: ${data.toString("hex")}`);

      if (data.length < 6) {
        console.error("Error: Insufficient data length");
        return;
      }

      const unitID = data.readUInt8(0); // Unit ID
      const functionCode = data.readUInt8(1); // Function Code
      const startAddress = data.readUInt16BE(2); // Starting Address
      const quantity = data.readUInt16BE(4); // Number of Registers to Read

      console.log(
        `Request - Unit ID: ${unitID}, Function Code: ${functionCode}, Start Address: ${startAddress}, Quantity: ${quantity}`
      );

      if (functionCode === 0x04) {
        // Function Code 4: Read Input Registers
        if (registers[unitID]) {
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

          // Log request to MongoDB
          const database = client.db("modbus_logs");
          const collection = database.collection("modbusLogs");
          const logEntry = {
            unitID,
            functionCode,
            startAddress,
            quantity,
            timestamp: new Date(),
            response: response.toString("hex"),
          };
          await collection.insertOne(logEntry);
          console.log(`Logged data to MongoDB: ${JSON.stringify(logEntry)}`);
        } else {
          console.error(`Unknown Unit ID: ${unitID}`);
          const errorResponse = Buffer.from([
            unitID,
            functionCode | 0x80, // Error flag
            0x02, // Exception Code: Illegal Data Address
          ]);
          socket.write(errorResponse);
        }
      } else {
        console.error(`Unsupported Function Code: ${functionCode}`);
        const errorResponse = Buffer.from([
          unitID,
          functionCode | 0x80, // Error flag
          0x01, // Exception Code: Illegal Function Code
        ]);
        socket.write(errorResponse);
      }
    } catch (error) {
      console.error(`Error processing request: ${error.message}`);
    }
  });

  socket.on("close", () => {
    console.log(`Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
  });

  socket.on("error", (error) => {
    console.error(`Socket error: ${error.message}`);
  });
});

// Start the TCP server
const PORT = 1234;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Modbus TCP server running at ${HOST}:${PORT}`);
});
