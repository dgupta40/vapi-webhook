// api/vapi/events.js
export default function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  
  // Parse body if it's a string
  if (typeof body === "string") {
    try { 
      body = JSON.parse(body); 
    } catch (e) { 
      body = {}; 
    }
  }

  // Return early if not a tool-call event
  if (!body || body.type !== "tool-call" || !body.toolCall) {
    return res.status(200).json({ ok: true });
  }

  const { id: toolCallId, name } = body.toolCall;

  let result;
  
  if (name === "create_ticket") {
    // Generate a unique ticket ID
    const ticketId = `TCK-${Date.now().toString().slice(-6)}`;
    result = { ticket_id: ticketId };
    
    console.log(`Created ticket: ${ticketId}`);
    
  } else if (name === "page_oncall") {
    result = { status: "sent" };
    
    console.log("On-call page sent");
    
  } else {
    // Handle unknown tool calls
    result = { ok: true };
    
    console.log(`Unknown tool call: ${name}`);
  }

  // Return the result to VAPI
  return res.status(200).json({ 
    toolCallId, 
    result 
  });
}