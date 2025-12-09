import sgMail, { MailDataRequired } from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const FRONTEND_URL = process.env.TEACHER_FRONTEND_URL!;

sgMail.setApiKey(SENDGRID_API_KEY);

export const paidPlanExpiryFollowUpReminderEmail = async ({
  email,
  name,
  schoolName,
  endDate,
  accountId,
}: {
  email: string;
  name: string;
  schoolName: string;
  endDate: string;
  accountId: string;
}) => {
  const renewLink = `${FRONTEND_URL}/#/pricing?accountId=${encodeURIComponent(
    accountId
  )}`;

  const msg: MailDataRequired = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: "WriteUp Team",
    },
    templateId: process.env.SENDGRID_FINAL_PLAN_END_TEMPLATE_ID!,
    dynamicTemplateData: {
      user_name: name,
      school_name: schoolName,
      expiry_date: endDate,
      renew_link: renewLink,
      company_logo:
        "https://res.cloudinary.com/vistaprint/images/c_scale,w_587,h_391,dpr_1.25/f_auto,q_auto/v1719942393/ideas-and-advice-prod/blogadmin/logo-chanel/logo-chanel.png?_i=AA",
      current_year: new Date().getFullYear(),
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Final plan expiry reminder sent to ${email}`);
  } catch (error: any) {
    console.error(
      `Failed to send final expiry email to ${email}:`,
      error.response?.body || error.message
    );
  }
};
