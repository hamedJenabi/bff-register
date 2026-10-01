export class RegistrationError extends Error {
  constructor(status, message, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const REGISTRATION_COMPLETE_MESSAGE = "Your registration is complete. Please contact the organizers to make changes.";
