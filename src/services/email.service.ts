/**
 * Placeholder email service.
 * Replace the implementation with actual provider integration
 * (e.g. SendGrid, SES, Resend) when ready.
 */
interface PaymentEmailPayload {
  to: string;
  subject: string;
  bodyText: string;
}

const logEmail = (payload: PaymentEmailPayload) => {
  console.info("[email::debug]", payload);
};

export const sendEmail = async (payload: PaymentEmailPayload) => {
  logEmail(payload);
  return Promise.resolve();
};

interface PaymentStatusContext {
  to: string;
  planName: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed";
  reason?: string;
}

export const sendPaymentStatusEmail = async (
  context: PaymentStatusContext
): Promise<void> => {
  const prettyAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: context.currency.toUpperCase(),
  }).format(context.amount);

  const subject =
    context.status === "succeeded"
      ? "Your payment was successful"
      : "Payment attempt failed";

  const bodyLines = [
    `Plan: ${context.planName}`,
    `Amount: ${prettyAmount}`,
    `Status: ${context.status.toUpperCase()}`,
  ];

  if (context.reason) bodyLines.push(`Reason: ${context.reason}`);

  await sendEmail({
    to: context.to,
    subject,
    bodyText: bodyLines.join("\n"),
  });
};

