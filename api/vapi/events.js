// api/vapi/events.js

import { google } from 'googleapis';

export default async function handler(req, res) {
  console.log('=== WEBHOOK CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Raw body type:', typeof req.body);
  console.log('Raw body:', req.body);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse JSON body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.log('JSON parse error:', e.message);
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  console.log('Processed body:', JSON.stringify(body, null, 2));

  // VAPI message format
  let messageData = body;
  if (body.message) {
    messageData = body.message;
  }
  console.log('Message data:', JSON.stringify(messageData, null, 2));

  // Handle tool-calls
  if (
    messageData.type === 'tool-calls' &&
    Array.isArray(messageData.toolCalls)
  ) {
    console.log('Found tool calls:', messageData.toolCalls.length);
    const results = [];

    for (const toolCall of messageData.toolCalls) {
      console.log('Processing tool call:', JSON.stringify(toolCall, null, 2));
      if (toolCall.type === 'function' && toolCall.function) {
        const functionName = toolCall.function.name;
        let functionArgs = {};
        const args = toolCall.function.arguments;

        if (typeof args === 'string') {
          try {
            functionArgs = JSON.parse(args);
          } catch {
            functionArgs = {};
          }
        } else if (args && typeof args === 'object') {
          functionArgs = args;
        }

        const result = await processToolCall(functionName, functionArgs);
        results.push({ toolCallId: toolCall.id, result });
      }
    }

    console.log('Sending results:', JSON.stringify(results, null, 2));
    return results.length === 1
      ? res.status(200).json(results[0])
      : res.status(200).json({ results });
  }

  // Fallback
  console.log('Not a tool call, returning OK');
  return res.status(200).json({ ok: true });
}

async function processToolCall(name, parameters) {
  console.log(`Processing: ${name}`);

  try {
    if (name === 'create_ticket') {
      const timestamp = Date.now();
      const ticketId = `TCK-${timestamp.toString().slice(-6)}`;
      const {
        name: tenant_name = '',
        unit = '',
        phone = '',
        priority = '',
        property = '',
        best_time = '',
        issue_text = '',
        access_granted = false,
      } = parameters;

      const ticketData = {
        ticket_id: ticketId,
        status: 'created',
        timestamp,
        created_date: new Date().toISOString(),
        tenant_info: {
          tenant_name,
          phone,
          property,
          unit,
          best_time,
          access_granted,
        },
        issue_details: {
          description: issue_text,
          priority,
        },
      };

      console.log(
        'Created ticket data:',
        JSON.stringify(ticketData, null, 2)
      );

      // Save to Google Sheets
      try {
        await saveToSheet(ticketData);
      } catch (err) {
        console.error('Sheet save error:', err.message);
      }

      console.log('=== TICKET CREATED ===');
      return {
        ticket_id: ticketId,
        status: 'created',
        timestamp,
        message: `Ticket ${ticketId} created for ${tenant_name} at ${property} unit ${unit}`,
        success: true,
      };
    } else if (name === 'page_oncall') {
      const timestamp = Date.now();
      return {
        status: 'sent',
        timestamp,
        message: `On-call technician notified for ticket ${parameters.ticket_id}`,
        success: true,
      };
    } else {
      console.log(`Unknown tool: ${name}`);
      return {
        status: 'error',
        message: `Unknown tool: ${name}`,
        success: false,
      };
    }
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    return {
      status: 'error',
      message: error.message,
      success: false,
    };
  }
}

// --- Google Sheets Integration via Service Account JWT ---

let sheetsClient;
async function getSheetsClient() {
  if (!sheetsClient) {
    // Decode service-account JSON from base64 env-var
    const key = JSON.parse(
      Buffer.from(process.env.GOOGLE_SA_KEY_BASE64, 'base64').toString()
    );

    const auth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

async function saveToSheet(ticketData) {
  const sheets = await getSheetsClient();
  const row = [
    [
      ticketData.ticket_id,
      ticketData.created_date,
      ticketData.tenant_info.tenant_name,
      ticketData.tenant_info.phone,
      ticketData.tenant_info.property,
      ticketData.tenant_info.unit,
      ticketData.issue_details.description,
      ticketData.issue_details.priority,
      ticketData.tenant_info.best_time || '',
      ticketData.tenant_info.access_granted ? 'Yes' : 'No',
      ticketData.status,
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `${process.env.SHEET_NAME || 'Tenant Complain'}!A:K`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: row },
  });

  console.log(' Ticket saved via service account');
}
