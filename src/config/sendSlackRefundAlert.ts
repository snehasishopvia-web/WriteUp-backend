import { WebClient } from "@slack/web-api";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN!);

export const sendSlackRefundAlert = async (payment: any) => {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;
    if (!channelId) return console.warn("Slack channel ID not configured");

    const status = payment.status || "pending";
    const headerText = status === "approved" ? "Refund Approved" : "Refund Request Submitted";

    const buttonElement =
      status === "pending"
        ? [
            {
              type: "button",
              text: { type: "plain_text", text: "Approve Refund", emoji: true },
              style: "primary",
              value: payment.refund_id || payment.id,
              action_id: "approve_refund",
            },
          ]
        : [];

    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: headerText, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*User:* ${payment.user_name} (${payment.user_email})` },
          { type: "mrkdwn", text: `*Plan:* ${payment.plan_name}` },
          { type: "mrkdwn", text: `*Payment Date:* ${new Date(payment.created_at).toLocaleDateString()}` },
          { type: "mrkdwn", text: `*Amount:* $${(payment.amount_cents / 100).toFixed(2)}` },
          { type: "mrkdwn", text: `*Reason:* ${payment.reason || "Not specified"}` },
          { type: "mrkdwn", text: `*Status:* ${status.toUpperCase()}` },
        ],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "_Please review the request and take action._" }],
      },
    ];

    if (buttonElement.length > 0) {
      blocks.push({
        type: "actions",
        elements: buttonElement,
      });
    }

    const res = await slackClient.chat.postMessage({
      channel: channelId,
      text: headerText,
      blocks,
    });

    console.log("Slack message sent:", res.ts);
  } catch (err) {
    console.error("Slack error:", err);
  }
};
