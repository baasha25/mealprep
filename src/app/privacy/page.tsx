import type { Metadata } from "next";
import { LegalDoc, Section, LEGAL_CONTACT, LEGAL_ENTITY, LEGAL_ADDRESS } from "@/components/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy — PrepFlow",
  description: "How PrepFlow collects, uses, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="August 13, 2026">
      <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        This Privacy Policy explains how PrepFlow — operated by {LEGAL_ENTITY} (&quot;we&quot;, &quot;us&quot;) —
        collects, uses, and shares personal information when you use PrepFlow (the &quot;Service&quot;). We
        handle personal information in accordance with Canada&apos;s <em>Personal Information Protection
        and Electronic Documents Act</em> (PIPEDA) and, where applicable, other privacy laws.
      </p>

      <Section heading="Our role">
        <p>
          For information about the people who run a Kitchen (owners and staff), PrepFlow acts as the
          business responsible for that data. For a Kitchen&apos;s <em>own customers</em> (diners who order
          from a Kitchen&apos;s storefront), the Kitchen decides how that data is used and PrepFlow
          processes it on the Kitchen&apos;s behalf.
        </p>
      </Section>

      <Section heading="Information we collect">
        <p><strong>Account information</strong> — name, email, and login details for Kitchen owners and staff (managed by our authentication provider).</p>
        <p><strong>Kitchen &amp; operational data</strong> — menus, recipes, inventory, orders, and settings you enter.</p>
        <p><strong>Customer information (on behalf of a Kitchen)</strong> — a diner&apos;s name, email, phone, delivery address, order history, dietary preferences, and loyalty balance.</p>
        <p><strong>Payment information</strong> — payments are handled by Stripe. We do not collect or store full card numbers; Stripe processes them directly.</p>
        <p><strong>Usage &amp; device data</strong> — pages viewed, referring website, approximate location (from IP), browser/device type, and interactions, used to operate and improve the Service.</p>
      </Section>

      <Section heading="How we use information">
        <p>
          To provide and secure the Service; process orders and subscriptions; send transactional
          email (confirmations, receipts, reminders); provide support; measure and improve product
          performance; understand where our signups come from; and comply with legal obligations.
        </p>
      </Section>

      <Section heading="Cookies &amp; analytics">
        <p>
          We use a small number of cookies. Some are essential to run the Service (for example,
          keeping you signed in). Others are used for analytics — understanding traffic and how the
          product is used — and for attribution (recording which channel referred a new signup).
          Where required, we ask for your consent before setting non-essential cookies, and you can
          decline. Analytics may be provided by PostHog. You can also control cookies through your
          browser settings.
        </p>
      </Section>

      <Section heading="Service providers (subprocessors)">
        <p>We share data with vendors who help us run the Service, under agreements that limit their use of it:</p>
        <p>
          <strong>Stripe</strong> (payments), <strong>Clerk</strong> (authentication),{" "}
          <strong>Resend</strong> (transactional email), <strong>Neon</strong> (database hosting),{" "}
          <strong>Netlify</strong> (application hosting), <strong>PostHog</strong> (product
          analytics), and <strong>Anthropic</strong> (AI processing of supplier invoices you upload,
          for the optional invoice-scanning feature). We do not sell personal information.
        </p>
      </Section>

      <Section heading="Data retention">
        <p>
          We keep personal information for as long as needed to provide the Service and for a
          reasonable period afterward, or as required by law. Kitchens can request deletion or export
          of their data; some records may be retained where we have a legal obligation to keep them.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          We use industry-standard measures to protect personal information, including encryption in
          transit and access controls. No method of transmission or storage is completely secure, but
          we work to protect your data and to notify affected users of a material breach as required
          by law.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Subject to applicable law, you may request access to, correction of, or deletion of your
          personal information, and you may withdraw consent for non-essential processing. To make a
          request, contact us at {LEGAL_CONTACT}. If PrepFlow processes information on behalf of a
          Kitchen, we will direct your request to that Kitchen where appropriate.
        </p>
      </Section>

      <Section heading="International transfers">
        <p>
          Our providers may process data in the United States or other countries. Where data crosses
          borders, we rely on the safeguards and terms offered by those providers.
        </p>
      </Section>

      <Section heading="Children">
        <p>The Service is not directed to children, and we do not knowingly collect their personal information.</p>
      </Section>

      <Section heading="Changes">
        <p>We may update this Policy; we will post the new version here and update the date above. Material changes will be communicated through the Service or by email.</p>
      </Section>

      <Section heading="Contact">
        <p>
          The organization responsible for personal information under this Policy is {LEGAL_ENTITY}.
          Privacy questions or requests (including access, correction, or deletion):{" "}
          {LEGAL_CONTACT}.{LEGAL_ADDRESS ? ` Mailing address: ${LEGAL_ADDRESS}.` : ""}
        </p>
      </Section>
    </LegalDoc>
  );
}
