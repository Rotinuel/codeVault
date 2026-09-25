// Terms & conditions text, shared by the /terms page and the sign-up modal so
// both always show the same wording. Plain component: no hooks, no server imports.
// When you change the substance of these terms, bump TERMS_VERSION in lib/constants.js.

const SECTIONS = (p) => [
  {
    title: "1. Eligibility",
    body: [
      "You must be at least 18 years old (or the legal gambling age where you live, if higher) to create an account. We may ask for proof of age and close accounts that don't meet this requirement.",
      "One person, one account. The details you give us (name, email address and WhatsApp number) must be accurate and your own.",
    ],
  },
  {
    title: "2. Nature of the service",
    body: [
      `${p} sells subscriptions to informational bet codes and analysis. We do not accept bets, hold wagers or act as a bookmaker. Any bets you place are made with third-party operators, under their rules and at your own risk.`,
      "No outcome is ever guaranteed. Past results, including winning tickets shown on our website, do not predict future results.",
    ],
  },
  {
    title: "3. Your account and email verification",
    body: [
      "You must confirm your email address with the code or link we send before you can use the platform. Keep your password private; you are responsible for activity on your account.",
      "We send service messages (verification, payment receipts, subscription and bet code alerts) by email, in-app and on WhatsApp. You can switch off optional alerts in your profile.",
    ],
  },
  {
    title: "4. Subscriptions & payments",
    body: [
      "Subscriptions are prepaid for a fixed period and processed by Paystack. We never see or store your card details. Your plan is activated only after Paystack confirms the payment to us.",
      "Access ends automatically at the end of the period unless you renew. Access to each bet code depends on the access level of your active plan. When you upgrade, unused value on your current plan is converted into bonus days.",
      "Because codes are released as soon as your plan is active, payments are generally non-refundable, except where the law requires otherwise or a payment was taken in error.",
    ],
  },
  {
    title: "5. Winning tickets & rewards",
    body: [
      "You may upload photos of your winning tickets. Our team checks each one; we may reject any ticket we cannot verify. Uploading fake, edited or someone else's tickets will lead to suspension of your account and loss of any rewards.",
      "If enough of your uploads in a calendar month are approved (the target and the discount are set by us and shown in your dashboard), you get the stated discount on one subscription payment in the following month. We may change or end the reward programme at any time; changes don't affect a discount you have already earned.",
      "If you tick the box to allow it, an approved ticket may be shown on our homepage without your name. You can ask us to remove it at any time. Please cover your bookmaker username or account number before uploading.",
    ],
  },
  {
    title: "6. Acceptable use",
    body: [
      "Accounts are personal. Sharing, reselling, publishing or redistributing bet codes, or sharing your login, may lead to suspension or permanent closure without refund.",
      "Don't attempt to access content above your plan, interfere with the platform, or use automated tools to scrape it.",
    ],
  },
  {
    title: "7. Privacy",
    body: [
      "We use your personal information to run your account, process payments, send the alerts you've chosen and verify winning tickets. We don't sell your data. Payment information is handled by Paystack and messages by our email and WhatsApp providers.",
    ],
  },
  {
    title: "8. Responsible gambling",
    body: [
      "Only stake what you can afford to lose, set limits on your time and money, and never chase losses. Gambling should never be a way to make money or solve financial problems.",
      "If gambling stops being fun, take a break and reach out to a local support organisation. You can ask us to close your account at any time.",
    ],
  },
  {
    title: "9. Changes and liability",
    body: [
      "We may update these terms; if the changes are significant we'll tell you in the app or by email. To the extent the law allows, we are not liable for betting losses or for losses caused by outages at bookmakers, Paystack, WhatsApp or other third parties.",
    ],
  },
];

export function TermsContent({ platformName = "CodeVault", className = "" }) {
  return (
    <div className={`space-y-6 text-sm leading-relaxed text-slate-700 ${className}`}>
      {SECTIONS(platformName).map((s) => (
        <section key={s.title}>
          <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
          {s.body.map((para, i) => (
            <p key={i} className="mt-2">
              {para}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
