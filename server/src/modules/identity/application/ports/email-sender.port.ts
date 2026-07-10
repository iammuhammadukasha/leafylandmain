/**
 * Port for sending the verification email. Stub implementation logs to
 * console instead of sending (task scope: "log the email to console
 * instead of sending it"). Swapping in a real provider later only means
 * a new infrastructure adapter — no application-layer change.
 */
export interface EmailSender {
  sendVerificationEmail(params: { to: string; token: string }): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
