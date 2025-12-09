import sgMail, { MailDataRequired } from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const STUDENT_FRONTEND_URL = process.env.STUDENT_FRONTEND_URL!;

sgMail.setApiKey(SENDGRID_API_KEY);

export const sendStudentPlanExpiredEmail = async ({
  email,
  name,
  schoolName,
}: {
  email: string;
  name: string;
  schoolName: string;
}) => {
  const loginLink = `${STUDENT_FRONTEND_URL}/#/login`;

  const msg: MailDataRequired = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: "WriteUp Team",
    },
    templateId: process.env.SENDGRID_STUDENT_FINAL_PLAN_END_TEMPLATE!,
    dynamicTemplateData: {
      student_name: name,
      school_name: schoolName,
      login_link: loginLink,
      current_year: new Date().getFullYear(),
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Student Expired Plan Email Sent To ${email}`);
  } catch (error: any) {
    console.error(
      `Failed to send student expiry email to ${email}:`,
      error.response?.body || error.message
    );
  }
};
