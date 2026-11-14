type OrderNotice = {
  order_number: string;
  email: string;
  status: string;
};

export async function sendOrderEmail(notice: OrderNotice) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [notice.email],
      subject: `Pizza Station order ${notice.order_number}`,
      text: `Your order ${notice.order_number} is now ${notice.status.replaceAll('_', ' ')}.`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    console.error('Resend notification failed:', response.status);
  }
}
