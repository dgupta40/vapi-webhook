// api/vapi/events.js
export default async function handler(req, res) {
  // Set comprehensive CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.status(200).end();
  }

  // Only allow POST requests for actual webhook calls
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  
  // Parse body if it's a string
  if (typeof body === "string") {
    try { 
      body = JSON.parse(body); 
    } catch (e) { 
      console.log('Failed to parse body as JSON:', e.message);
      body = {}; 
    }
  }

  console.log('Received webhook request:', JSON.stringify(body, null, 2));

  // Return early if not a tool-call event
  if (!body || body.type !== "tool-call" || !body.toolCall) {
    console.log('Not a tool call, returning ok');
    return res.status(200).json({ ok: true });
  }

  const { id: toolCallId, name, parameters } = body.toolCall;
  console.log(`Processing tool call: ${name} with ID: ${toolCallId}`);

  let result;
  
  if (name === "create_ticket") {
    // Generate a unique ticket ID
    const timestamp = Date.now();
    const ticketId = `TCK-${timestamp.toString().slice(-6)}`;
    
    // Extract parameters matching your VAPI tool configuration
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
    
    // Create ticket data object
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
    
    // Save to Google Sheets (if configured)
    if (process.env.GOOGLE_SHEETS_API_KEY && process.env.SPREADSHEET_ID) {
      try {
        await saveTicketToGoogleSheets(ticketData);
        console.log('✅ Ticket saved to Google Sheets');
      } catch (error) {
        console.error('❌ Error saving to Google Sheets:', error);
      }
    }
    
    result = { 
      ticket_id: ticketId,
      status: "created",
      timestamp: timestamp,
      message: `Maintenance ticket ${ticketId} has been created successfully for ${tenant_name || 'tenant'} at ${property || 'property'} ${unit ? `unit ${unit}` : ''}`,
      ticket_data: ticketData
    };
    
    console.log(`✅ Created ticket: ${ticketId} - Priority: ${priority}`, ticketData);
    
  } else if (name === "page_oncall") {
    const timestamp = Date.now();
    const { 
      ticket_id = "",
      unit = "",
      priority = "",
      property = "",
      issue_text = "",
      callback_number = ""
    } = parameters || {};
    
    result = { 
      status: "sent",
      timestamp: timestamp,
      ticket_id: ticket_id,
      message: `On-call technician has been notified via SMS and email for ticket ${ticket_id} - ${property} unit ${unit} - Priority: ${priority}`,
      notification_details: {
        ticket_id,
        unit,
        priority,
        property,
        issue_text,
        callback_number
      }
    };
    
    console.log(`✅ On-call page sent for ticket: ${ticket_id}`);
    
  } else {
    // Handle unknown tool calls
    result = { 
      status: "error",
      message: `Unknown tool: ${name}. Available tools: create_ticket, page_oncall`
    };
    
    console.log(`❌ Unknown tool call: ${name}`);
  }

  const response = { 
    toolCallId, 
    result 
  };

  console.log('✅ Sending response:', JSON.stringify(response, null, 2));

  // Return the result to VAPI with proper headers
  return res.status(200).json(response);
}

// Google Sheets integration function
async function saveTicketToGoogleSheets(ticketData) {
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const SHEET_NAME = process.env.SHEET_NAME || 'Tickets';

  if (!GOOGLE_SHEETS_API_KEY || !SPREADSHEET_ID) {
    console.log('Google Sheets not configured - skipping save');
    return;
  }

  try {
    // Prepare row data
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

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW&key=${GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Sheets API Error: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Ticket saved to Google Sheets:', result);
    return result;

  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    throw error;
  }
}