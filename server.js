const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());

app.post("/vapi/events", (req, res) => {
  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  if (!body || body.type !== "tool-call" || !body.toolCall) {
    return res.status(200).json({ ok: true });
  }

  const { id: toolCallId, name } = body.toolCall;

  let result;
  if (name === "create_ticket") {
    const ticketId = `TCK-${Date.now().toString().slice(-6)}`;
    result = { ticket_id: ticketId };
  } else if (name === "page_oncall") {
    result = { status: "sent" };
  } else {
    result = { ok: true };
  }

  return res.status(200).json({ toolCallId, result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook listening on :${PORT}`));
