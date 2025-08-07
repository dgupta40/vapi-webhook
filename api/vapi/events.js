// api/vapi/events.js
export default async function handler(req, res) {
  console.log('Webhook called:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  
  if (typeof body === "string") {
    try { 
      body = JSON.parse(body); 
      console.log('Parsed body from string');
    } catch (e) { 
      console.log('Failed to parse body as JSON:', e.message);
      body = {}; 
    }
  }

  console.log('Processing body:', JSON.stringify(body, null, 2));

  // Handle both VAPI format (tool-calls) and direct format (tool-call)
  let toolCall = null;
  let toolCallId = null;
  
  if (body?.message?.type === "tool-calls" && body?.message?.toolCalls?.length > 0) {
    console.log('Detected VAPI tool-calls format');
    const firstCall = body.message.toolCalls[0];
    if (firstCall.type === "function" && firstCall.function) {
      toolCall = {
        name: firstCall.function.name,
        parameters: JSON.parse(firstCall.function.arguments || '{}')
      };
      toolCallId = firstCall.id;
    }
  } else if (body?.type === "tool-call" && body?.toolCall) {
    console.log('Detected direct tool-call format');
    toolCall = body.toolCall;
    toolCallId = toolCall.id;
  } else {
    console.log('Not a recognized tool call format');
    return res.status(200).json({ 
      ok: true, 
      debug: 'not-a-tool-call',
      received_type: body?.type,
      message_type: body?.message?.type
    });
  }

  if (!toolCall || !toolCall.name) {
    console.log('Invalid tool call structure');
    return res.status(200).json({ ok: true, debug: 'invalid-tool-call' });
  }

  const { name, parameters } = toolCall;
  console.log(`Processing tool: ${name} with ID: ${toolCallId}`);
  console.log('Parameters:', JSON.stringify(parameters, null, 2));

  let result;
  
  try {
    if (name === "create_ticket") {
      console.log('Creating maintenance ticket');
      
      const timestamp = Date.now();
      const ticketId = `TCK-${timestamp.toString().slice(-6)}`;
      
      const {
        name: tenant_name = "",
        unit = "",
        phone = "",
        priority = "",
        property = "",
        best_time = "",
        issue_text = "",
        access_granted = false
      } = parameters || {};
      
      console.log('Extracted data:', {
        tenant_name, unit, phone, priority, property, best_time, issue_text, access_granted
      });

      const ticketData = {
        ticket_id: ticketId,
        status: "created",
        timestamp: timestamp,
        created_date: new Date().toISOString(),
        tenant_info: {
          name: tenant_name,
          phone: phone,
          property: property,
          unit: unit,
          best_time: best_time,
          access_granted: access_granted
        },
        issue_details: {
          description: issue_text,
          priority: priority
        }
      };

      console.log('Created ticket:', JSON.stringify(ticketData, null, 2));

      // Save to Google Sheets if configured
      try {
        if (process.env.GOOGLE_SHEETS_API_KEY && process.env.SPREADSHEET_ID) {
          console.log('Saving to Google Sheets');
          await saveTicketToGoogleSheets(ticketData);
          console.log('Successfully saved to Google Sheets');
        } else {
          console.log('Google Sheets not configured');
        }
      } catch (sheetError) {
        console.error('Google Sheets save failed:', sheetError);
      }

      result = { 
        ticket_id: ticketId,
        status: "created",
        timestamp: timestamp,
        message: `Maintenance ticket ${ticketId} created for ${tenant_name} at ${property} unit ${unit}`,
        ticket_data: ticketData
      };

      console.log('create_ticket result:', JSON.stringify(result, null, 2));

    } else if (name === "page_oncall") {
      console.log('Paging on-call technician');
      
      const timestamp = Date.now();
      const { 
        ticket_id = "",
        unit = "",
        priority = "",
        property = "",
        issue_text = "",
        callback_number = ""
      } = parameters || {};

      console.log('page_oncall parameters:', {
        ticket_id, unit, priority, property, issue_text, callback_number
      });

      result = { 
        status: "sent",
        timestamp: timestamp,
        ticket_id: ticket_id,
        message: `On-call technician notified for ticket ${ticket_id} at ${property} unit ${unit}`,
        notification_details: {
          ticket_id, unit, priority, property, issue_text, callback_number
        }
      };

      console.log('page_oncall result:', JSON.stringify(result, null, 2));

    } else {
      console.log(`Unknown tool: ${name}`);
      result = { 
        status: "error",
        message: `Unknown tool: ${name}. Available tools: create_ticket, page_oncall`
      };
    }

  } catch (error) {
    console.error('Error processing tool call:', error);
    result = {
      status: "error",
      message: `Error processing ${name}: ${error.message}`
    };
  }

  const response = { 
    toolCallId, 
    result 
  };

  console.log('Sending response:', JSON.stringify(response, null, 2));
  console.log('Webhook processing complete');

  return res.status(200).json(response);
}

async function saveTicketToGoogleSheets(ticketData) {
  const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const SHEET_NAME = process.env.SHEET_NAME || 'Tenant Complain';

  if (!API_KEY || !SPREADSHEET_ID) {
    throw new Error('Google Sheets configuration missing');
  }

  const rowData = [
    ticketData.ticket_id,
    ticketData.created_date,
    ticketData.tenant_info.name,
    ticketData.tenant_info.phone,
    ticketData.tenant_info.property,
    ticketData.tenant_info.unit,
    ticketData.issue_details.description,
    ticketData.issue_details.priority,
    ticketData.tenant_info.best_time,
    ticketData.tenant_info.access_granted ? 'Yes' : 'No',
    ticketData.status
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW&key=${API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [rowData] })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets API Error: ${error}`);
  }

  return await response.json();
}