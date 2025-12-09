import sgMail, { MailDataRequired } from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const FRONTEND_URL = process.env.TEACHER_FRONTEND_URL!;
const COMPANY_LOGO_URL = "https://res.cloudinary.com/vistaprint/images/c_scale,w_587,h_391,dpr_1.25/f_auto,q_auto/v1719942393/ideas-and-advice-prod/blogadmin/logo-chanel/logo-chanel.png?_i=AA";

sgMail.setApiKey(SENDGRID_API_KEY);

export const sendTeacherOnboardEmail = async (
  email: string,
  teacherName: string,
  schoolName: string,
  schoolKey: string
) => {
  
  const teacherPortalLink = `${FRONTEND_URL}/#/register-with-email?email=${encodeURIComponent(
  email
)}&school=${encodeURIComponent(schoolKey)}`;


  const msg: MailDataRequired = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: "WriteUp Team",
    },
    templateId: process.env.SENDGRID_TEACHER_ONBOARD_TEMPLATE_ID!,
    dynamicTemplateData: {
      teacher_name: teacherName,
      school_name: schoolName,
      teacher_portal_link: teacherPortalLink,
      company_logo: COMPANY_LOGO_URL,
      current_year: new Date().getFullYear(),
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Student onboarding email sent to ${email}`);
  } catch (error: any) {
    console.error(
      `Failed to send student onboarding email to ${email}:`,
      error.response?.body || error.message
    );
  }
};
