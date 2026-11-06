const mailbox = () => {
  globalThis.__bffPreviewScheduleInvitations ||= [];
  return globalThis.__bffPreviewScheduleInvitations;
};

export const capturePreviewInvitation = async (message) => {
  mailbox().push({
    to: message.to,
    firstname: message.dynamic_template_data.firstname,
    regi2026link: message.dynamic_template_data.regi2026link,
  });
};

export const previewInvitations = () => mailbox();

const confirmations = () => {
  globalThis.__bffPreviewRegistrationConfirmations ||= [];
  return globalThis.__bffPreviewRegistrationConfirmations;
};

export const capturePreviewConfirmation = async (message) => {
  confirmations().push({ to: message.to, templateId: message.template_id, ...message.dynamic_template_data });
};

export const previewConfirmations = () => confirmations();
