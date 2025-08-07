// api/test.js
export default function handler(req, res) {
  const testData = {
    status: 'success',
    message: 'VAPI Webhook is running!',
    timestamp: new Date().toISOString(),
    environment: {
      hasGoogleSheetsKey: !!process.env.GOOGLE_SHEETS_API_KEY,
      hasSpreadsheetId: !!process.env.SPREADSHEET_ID,
      sheetName: process.env.SHEET_NAME || 'Tickets',
      // Debug info
      allEnvVars: {
        GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY ? 'SET' : 'NOT SET',
        SPREADSHEET_ID: process.env.SPREADSHEET_ID ? 'SET' : 'NOT SET',
        SHEET_NAME: process.env.SHEET_NAME || 'NOT SET'
      }
    },
    endpoint: `${req.headers.host}/api/vapi/events`
  };

  res.status(200).json(testData);
}