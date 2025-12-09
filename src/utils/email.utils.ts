import sgMail, { MailDataRequired } from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const FRONTEND_URL = process.env.FRONTEND_URL!;
const COMPANY_NAME = "WriteUp";
const COMPANY_LOGO_URL =
  "https://res.cloudinary.com/vistaprint/images/c_scale,w_587,h_391,dpr_1.25/f_auto,q_auto/v1719942393/ideas-and-advice-prod/blogadmin/logo-chanel/logo-chanel.png?_i=AA";

sgMail.setApiKey(SENDGRID_API_KEY);

export const sendVerificationEmail = async (
  email: string,
  token: string,
  plan: { name: string; price_monthly: number; price_yearly?: number }
) => {
  const verifyLink = `${FRONTEND_URL}/verify-email?token=${token}`;

  const msg: MailDataRequired = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: `${COMPANY_NAME} Support`,
    },
    templateId: process.env.SENDGRID_Template_ID!,
    dynamicTemplateData: {
      verify_link: verifyLink,
      company_name: COMPANY_NAME,
      company_logo: COMPANY_LOGO_URL,
      plan_name: plan.name,
      plan_monthly: Number(plan.price_monthly || 0).toFixed(2),
      plan_yearly: plan.price_yearly
        ? Number(plan.price_yearly).toFixed(2)
        : null,
      current_year: new Date().getFullYear(),
    },
  } as MailDataRequired;

  await sgMail.send(msg);
  console.log(`Verification email sent to ${email}`);
};