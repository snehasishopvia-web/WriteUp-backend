import sgMail, { MailDataRequired } from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const COMPANY_LOGO_URL =
  "https://res.cloudinary.com/vistaprint/images/c_scale,w_587,h_391,dpr_1.25/f_auto,q_auto/v1719942393/ideas-and-advice-prod/blogadmin/logo-chanel/logo-chanel.png?_i=AA";

sgMail.setApiKey(SENDGRID_API_KEY);

interface Payment {
  id: string;
  user_name: string;
  user_email: string;
}

export const sendAdminRefundEmail = async (payment: Payment) => {
  const msg: MailDataRequired = {
    to: payment.user_email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: "WriteUp Team",
    },
    templateId: process.env.SENDGRID_REFUND_TEMPLATE_ID!,
    dynamicTemplateData: {
      name: payment.user_name,
      payment_id: payment.id,
      company_logo: COMPANY_LOGO_URL,
      current_year: new Date().getFullYear(),
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Admin refund email sent for payment ${payment.id}`);
  } catch (error: any) {
    console.error(
      `Failed to send admin refund email for payment ${payment.id}:`,
      error.response?.body || error.message
    );
  }
};
