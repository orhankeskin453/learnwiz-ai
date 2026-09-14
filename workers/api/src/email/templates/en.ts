import { htmlShell, type TemplateContent, type TemplateParams } from "./shell";

export function verificationEn({ url, email }: TemplateParams): TemplateContent {
  const subject = "Verify your LearnWiz AI email address";
  const heading = "Confirm your email";
  const paragraphs = [
    email ? `Welcome to LearnWiz AI, ${email}!` : "Welcome to LearnWiz AI!",
    "Confirm this email address to activate your account and start learning.",
    "This link expires in 24 hours and can be used only once.",
  ];
  return {
    subject,
    html: htmlShell(
      heading,
      paragraphs,
      "Verify email",
      url,
      "You received this email because an account was created on LearnWiz AI.",
    ),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
  };
}

export function welcomeEn({ url }: TemplateParams): TemplateContent {
  const subject = "Welcome to LearnWiz AI";
  const heading = "Your account is ready";
  const paragraphs = [
    "Your email is verified and your account is active.",
    "Meet your AI teacher: learn concepts, practice with feedback and build real mastery.",
  ];
  return {
    subject,
    html: htmlShell(
      heading,
      paragraphs,
      "Start learning",
      url,
      "LearnWiz AI — Learn anything. With your AI teacher.",
    ),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
  };
}

export function passwordResetEn({ url }: TemplateParams): TemplateContent {
  const subject = "Reset your LearnWiz AI password";
  const heading = "Password reset requested";
  const paragraphs = [
    "We received a request to reset your password.",
    "This link expires in 1 hour and can be used only once. If you did not request it, you can safely ignore this email — your password stays unchanged.",
  ];
  return {
    subject,
    html: htmlShell(
      heading,
      paragraphs,
      "Choose a new password",
      url,
      "LearnWiz AI — security notification.",
    ),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
  };
}
