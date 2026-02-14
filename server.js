import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDatabase, bulkImportTasks } from "./db.js";
import setupSocket from "./socket.js";
import { setupAuth, requireAuth } from "./auth.js";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
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

// Setup authentication
setupAuth(app);

// Setup socket connection
setupSocket(io);

// Routes
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "public", "index.html"));
});

// Serve the analytics page
app.get("/analytics", (req, res) => {
    res.sendFile(join(__dirname, "public", "analytics.html"));
});

// CSV Import endpoint
app.post("/api/import-csv", requireAuth, upload.single("csvFile"), async (req, res) => {
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

        // Helper function to convert text urgency to numeric
        const parseUrgency = (value) => {
            if (!value) return undefined;
            const val = value.toString().toLowerCase();
            if (val.includes('urgent') && !val.includes('not')) return 9; // "Urgent" → 9
            if (val.includes('not urgent') || val.includes('not_urgent')) return 3; // "Not Urgent" → 3
            // Try to parse as number
            const num = Number(value);
            return !isNaN(num) ? num : undefined;
        };

        // Map to expected format with flexible column matching
        const tasksToImport = normalizedRecords.map(record => ({
            id: record.id, // Capture original ID for mapping
            name: record.name || record.task || record['task name'] || record.title,
            importance: Math.round(Number(record.importance || record.important) || 5),
            urgency: Math.round(Number(parseUrgency(record.urgency || record.urgent)) || 5),
            done: record.done === 'true' || record.done === true || record.status === 'completed',
            link: record.link || record.url || null,
            due_date: record.due_date || record.duedate || record['due date'] || record.due || null,
            notes: record.notes || record.note || record.description || null,
            parent_id: record.parent_id || record.parentid || record['parent id'] || null,
            total_time_spent: Math.round(Number(record.total_time_spent) || 0),
            pomodoro_count: Math.round(Number(record.pomodoro_count) || 0),
            // Store additional metadata that might be useful
            progress: record.progress ? Math.round(Number(record.progress)) : null,
            category: record.category || null,
            status: record.status || null
        }));

        console.log("Tasks to import sample:", tasksToImport[0]);

        // Import tasks into database with userId
        const userId = req.user ? req.user.id : null;
        const result = await bulkImportTasks(tasksToImport, userId);

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

// CSV Export endpoint
app.get("/api/export-csv", requireAuth, async (req, res) => {
    try {
        const { getTaskData } = await import("./db.js");
        const userId = req.user ? req.user.id : null;
        const tasks = await getTaskData(userId);
        
        // Define CSV headers
        const columns = [
            'name',
            'importance',
            'urgency',
            'done',
            'link',
            'due_date',
            'notes',
            'parent_id',
            'created_at',
            'completed_at',
            'total_time_spent',
            'pomodoro_count',
            'category',
            'status'
        ];

        // Format tasks for CSV
        const csvData = tasks.map(task => [
            task.name,
            task.importance,
            task.urgency,
            task.done ? 'true' : 'false',
            task.link,
            task.due_date,
            task.notes,
            task.parent_id,
            task.created_at,
            task.completed_at,
            task.total_time_spent,
            task.pomodoro_count,
            task.category,
            task.status
        ]);

        const csvContent = stringify(csvData, { header: true, columns: columns });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=tasks-export-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error("CSV export error:", error);
        res.status(500).json({ error: "Failed to export CSV" });
    }
});

// Analytics API endpoint
app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
        const { getTaskData, getTimeLogs } = await import("./db.js");
        
        // Get all tasks with time data
        const tasks = await getTaskData();
        
        // Get all time logs for all tasks
        const allLogs = [];
        for (const task of tasks) {
            const logs = await getTimeLogs(task.id);
            allLogs.push(...logs.map(log => ({ ...log, task_name: task.name })));
        }
        
        res.json({
            tasks,
            timeLogs: allLogs
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ error: "Failed to fetch analytics data" });
    }
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