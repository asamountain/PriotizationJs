# Priority Task Manager 📋

**Welcome to Priority Task Manager!** This application helps you organize tasks based on the Eisenhower Matrix (Importance vs. Urgency) with real-time synchronization across all your devices.

## Key Features ✨

- **Google OAuth Sync**: Log in to sync your tasks and priorities across laptops and mobile devices.
- **Eisenhower Matrix**: Visual scatter-plot chart to help you prioritize what matters.
- **Recursive Subtasks**: Create infinitely nested task hierarchies.
- **Time Tracking**: Built-in Pomodoro timer and session logging for every task.
- **Cloud Database**: Support for PostgreSQL (Cloud) with local SQLite fallback.
- **Perfect Data Migration**: Export and Import CSV with 100% hierarchy preservation.

## Getting Started 🚀

### 1. First Time Setup
Make sure you have [Node.js](https://nodejs.org/) installed.
```bash
git clone https://github.com/asamountain/PriotizationNodeJs.git
cd PriotizationNodeJs
npm install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` and fill in your credentials:
- **Google OAuth**: Get these from the [Google Cloud Console](https://console.cloud.google.com/).
- **Cloud Database**: Use [Neon.tech](https://neon.tech/) for a free PostgreSQL instance.
- **Base URL**: Set to `http://localhost:3000` for local or your live URL for production.

### 3. Starting the App
#### On Mac:
Double-click `start-app.command` or run `npm start`.
#### On Windows:
Run `npm start` in your terminal.

## How to Sync Across Devices 🔄

1.  **Configure `.env`**: Ensure `DATABASE_URL` (Postgres) and Google OAuth keys are set.
2.  **Log In**: Click the "Login with Google" button.
3.  **Automatic Sync**: Any task you add while logged in is instantly saved to the cloud and available on any other device you log into.

## CSV Import/Export Tips 📂

- **Hierarchy**: To move tasks between different environments, use the **Export** button (Download icon) to generate a CSV with IDs.
- **Importing**: When importing, the system automatically rebuilds your subtask hierarchy and "claims" any anonymous tasks for your logged-in account.
- **No Duplicates**: The system checks for existing task names to prevent double entries.

## Guides & Documentation 📖

- [GOOGLE_SHEETS_IMPORT_GUIDE.md](./GOOGLE_SHEETS_IMPORT_GUIDE.md) - How to format your bulk uploads.
- [POMODORO_TIMER_GUIDE.md](./POMODORO_TIMER_GUIDE.md) - Using the productivity timer.
- [ANALYTICS_GUIDE.md](./ANALYTICS_GUIDE.md) - Understanding your task insights.

## Troubleshooting 🔍

- **Unknown authentication strategy "google"**: Ensure your `.env` file has valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Restart the server completely.
- **Tasks not appearing**: Ensure you are logged into the same account on both devices. Check the browser console for sync errors.

---
Enjoy using your new Priority Task Manager!
