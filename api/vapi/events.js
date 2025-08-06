// api/vapi/events.js

export default async function handler(req, res) {
  // Only process POST requests
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  // Parse incoming body
  const body = req.body || {};
  if (body.type !== "tool-call" || !body.toolCall) {
    return res.status(200).json({ ok: true });
  }

  // Extract tool call data
  const { id: toolCallId, name, arguments: args = {} } = body.toolCall;
  let result;

  // Handle each tool by name
  switch (name) {
    case "create_ticket":
      // Generate a simple ticket ID
      result = { ticket_id: `TCK-${Date.now().toString().slice(-6)}` };  
      break;

    case "page_oncall":
      // Simulate paging on-call
      result = { status: "sent" };
      break;

    default:
      // For all other calls, no action needed
      result = { ok: true };
  }

  // Vapi expects { toolCallId, result }
  return res.status(200).json({ toolCallId, result });
}
