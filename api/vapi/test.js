// api/test.js
export default function handler(req, res) {
  const testData = {
    status: 'success',
    message: 'VAPI Webhook is running!',
    timestamp: new Date().toISOString(),
    environment: {
      hasGoogleSheetsKey: !!process.env.GOOGLE_SHEETS_API_KEY,
      hasSpreadsheetId: !!process.env.SPREADSHEET_ID,
      sheetName: process.env.SHEET_NAME || 'Tickets'
    },
    endpoint: `${req.headers.host}/api/vapi/events`
  };

  res.status(200).json(testData);
}