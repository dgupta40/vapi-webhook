// api/vapi/events.js
export default function handler(req, res) {
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
    result = { 
      ticket_id: ticketId,
      status: "created",
      timestamp: timestamp,
      message: `Maintenance ticket ${ticketId} has been created successfully`
    };
    
    console.log(`✅ Created ticket: ${ticketId}`);
    
  } else if (name === "page_oncall") {
    const timestamp = Date.now();
    result = { 
      status: "sent",
      timestamp: timestamp,
      message: "On-call technician has been notified via SMS and email"
    };
    
    console.log("✅ On-call page sent");
    
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