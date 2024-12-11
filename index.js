import socket
import datetime

# Server configuration
SERVER_IP = "0.0.0.0"  # Listen on all available interfaces
SERVER_PORT = 12345    # The UDP port to listen on
LOG_FILE = "rtu_data_log.txt"  # File to log incoming raw data

# Create a UDP socket
udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
udp_socket.bind((SERVER_IP, SERVER_PORT))

print(f"Server listening on {SERVER_IP}:{SERVER_PORT}...")

try:
    with open(LOG_FILE, "a") as log_file:
        while True:
            # Receive data (buffer size of 1024 bytes)
            data, addr = udp_socket.recvfrom(1024)
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Log the raw data with timestamp and sender information
            log_entry = f"[{timestamp}] Data from {addr}: {data}\n"
            print(log_entry.strip())
            log_file.write(log_entry)
            log_file.flush()  # Ensure data is written to the file immediately

except KeyboardInterrupt:
    print("\nServer stopped by user.")
finally:
    udp_socket.close()
    print("Socket closed.")
