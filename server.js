import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDatabase, bulkImportTasks } from "./db.js";
import setupSocket from "./socket.js";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { readFileSync, unlinkSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Express setup
const app = express();
const server = createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static(join(__dirname, "public")));
app.use(express.json());

// Setup socket connection
setupSocket(io);

// Routes
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "public", "index.html"));
});

// CSV Import endpoint
app.post("/api/import-csv", upload.single("csvFile"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // Read the uploaded file with proper encoding handling
        let fileContent = readFileSync(req.file.path, "utf-8");
        
        // Remove BOM (Byte Order Mark) if present - common in Google Sheets exports
        if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
        }

        console.log("CSV file first 200 chars:", fileContent.substring(0, 200));

        // Parse CSV with flexible options
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            relax_column_count: true,
            bom: true
        });

        console.log("Parsed records count:", records.length);
        if (records.length > 0) {
            console.log("First record columns:", Object.keys(records[0]));
            console.log("First record sample:", records[0]);
        }

        // Normalize column names to lowercase for flexible matching
        const normalizedRecords = records.map(record => {
            const normalized = {};
            for (const key in record) {
                const lowerKey = key.toLowerCase().trim();
                normalized[lowerKey] = record[key];
            }
            return normalized;
        });

        // Map to expected format
        const tasksToImport = normalizedRecords.map(record => ({
            name: record.name || record.task || record['task name'] || record.title,
            importance: record.importance,
            urgency: record.urgency,
            done: record.done,
            link: record.link || record.url,
            due_date: record.due_date || record.duedate || record['due date'],
            notes: record.notes || record.note || record.description,
            parent_id: record.parent_id || record.parentid || record['parent id']
        }));

        console.log("Tasks to import sample:", tasksToImport[0]);

        // Import tasks into database
        const result = await bulkImportTasks(tasksToImport);

        // Clean up uploaded file
        unlinkSync(req.file.path);

        // Emit update to all connected clients
        io.emit("csvImported", result);

        res.json({
            success: true,
            message: `Successfully imported ${result.imported} tasks`,
            details: result
        });

    } catch (error) {
        console.error("CSV import error:", error);
        console.error("Error stack:", error.stack);
        
        // Clean up file if it exists
        if (req.file && req.file.path) {
            try {
                unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error("Failed to clean up file:", unlinkError);
            }
        }

        res.status(500).json({
            error: "Failed to import CSV",
            message: error.message
        });
    }
});

// Download CSV template endpoint
app.get("/api/csv-template", (req, res) => {
    const template = `name,importance,urgency,done,link,due_date,notes,parent_id
Sample Task,8,7,false,https://example.com,2025-12-31,This is a sample note,
Another Task,5,5,false,,,,`;
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=task-template.csv");
    res.send(template);
});

// Server initialization
const startServer = async (port = 3000) => {
    try {
        await initDatabase();
        server.listen(port, async () => {
            const url = `http://localhost:${port}`;
            console.log(`\n✅ Server started successfully!`);
            console.log(`📍 URL: ${url}`);
            console.log(`💡 Tip: Open the URL in your browser or keep using your existing tab\n`);
            
            // Only open browser if OPEN_BROWSER environment variable is set to true
            // This prevents opening a new tab every time you restart the server
            if (process.env.OPEN_BROWSER === 'true') {
                const { exec } = await import('child_process');
                console.log(`Opening browser at ${url}`);
                
                // Determine the command based on the operating system
                let command;
                switch (process.platform) {
                    case 'darwin':  // macOS
                        command = `open "${url}"`;
                        break;
                    case 'win32':   // Windows
                        command = `start "" "${url}"`;
                        break;
                    default:        // Linux and others
                        command = `xdg-open "${url}"`;
                        break;
                }
                
                // Execute the command and handle errors
                exec(command, (error) => {
                    if (error) {
                        console.error('Error opening browser:', error);
                    }
                });
            }
        });
    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

// Handle port conflicts
const findAvailablePort = (startPort) => {
    return new Promise((resolve) => {
        const server = createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on("error", () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
};

// Start server with dynamic port
findAvailablePort(3000)
    .then(port => startServer(port))
    .catch(error => {
        console.error("Port finding failed:", error);
        process.exit(1);
    });

// Error handling
process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});