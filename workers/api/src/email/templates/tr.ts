import { htmlShell, type TemplateContent, type TemplateParams } from "./shell";

export function verificationTr({ url, email }: TemplateParams): TemplateContent {
  const subject = "LearWizAI e-posta adresinizi doğrulayın";
  const heading = "E-postanızı doğrulayın";
  const paragraphs = [
    email ? `LearWizAI'e hoş geldiniz, ${email}!` : "LearWizAI'e hoş geldiniz!",
    "Hesabınızı etkinleştirmek ve öğrenmeye başlamak için bu e-posta adresini doğrulayın.",
    "Bu bağlantı 24 saat geçerlidir ve yalnızca bir kez kullanılabilir.",
  ];
  return {
    subject,
    html: htmlShell(
      heading,
      paragraphs,
      "E-postamı doğrula",
      url,
      "Bu e-postayı LearWizAI üzerinde bir hesap oluşturulduğu için aldınız.",
    ),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
  };
}

export function welcomeTr({ url }: TemplateParams): TemplateContent {
  const subject = "LearWizAI'e hoş geldiniz";
  const heading = "Hesabınız hazır";
  const paragraphs = [
    "E-postanız doğrulandı ve hesabınız etkin.",
    "AI öğretmeninizle tanışın: kavramları öğrenin, geri bildirimle pratik yapın, gerçek hakimiyet kazanın.",
  ];
  return {
    subject,
    html: htmlShell(
      heading,
      paragraphs,
      "Öğrenmeye başla",
      url,
      "LearWizAI — Learn anything. With your AI teacher.",
    ),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
  };
}

export function passwordResetTr({ url }: TemplateParams): TemplateContent {
  const subject = "LearWizAI şifrenizi sıfırlayın";
  const heading = "Şifre sıfırlama talebi";
  const paragraphs = [
    "Şifrenizi sıfırlama talebiniz alındı.",
    "Bu bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz — şifreniz değişmeden kalır.",
  ];
  return {
    subject,
    html: htmlShell(
      heading,
      paragraphs,
      "Yeni şifre belirle",
      url,
      "LearWizAI — güvenlik bildirimi.",
    ),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
  };
}
