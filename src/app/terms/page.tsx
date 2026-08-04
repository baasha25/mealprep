import type { Metadata } from "next";
import { LegalDoc, Section, LEGAL_CONTACT } from "@/components/legal-doc";

export const metadata: Metadata = {
  title: "Terms of Service — PrepFlow",
  description: "The terms that govern your use of PrepFlow.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="August 1, 2026">
      <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of PrepFlow (the
        &quot;Service&quot;), operated by PrepFlow (&quot;PrepFlow&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or
        using the Service, you agree to these Terms. If you are using PrepFlow on behalf of a
        business, you agree on its behalf and represent that you are authorized to do so.
      </p>

      <Section heading="1. The Service">
        <p>
          PrepFlow is software that helps independent meal-prep businesses (&quot;Kitchens&quot;) run their
          operations — a branded storefront, meal-plan subscriptions, payment tooling, kitchen
          production, inventory, delivery hand-off, and related features. PrepFlow provides the
          software; it does not prepare, sell, or deliver food.
        </p>
      </Section>

      <Section heading="2. Accounts">
        <p>
          You must provide accurate information and keep your login credentials secure. You are
          responsible for all activity under your account, including that of staff you invite. You
          must be at least the age of majority in your jurisdiction to use the Service.
        </p>
      </Section>

      <Section heading="3. Free trial, plans & billing">
        <p>
          New Kitchens receive a free trial (currently 30 days) with access to the Service. After
          the trial, continued use of the owner dashboard requires a paid subscription plan. Plan
          prices, order limits, and the platform fee are shown in the app and on our pricing page and
          may be updated on notice. Software subscriptions are billed monthly (or annually) in
          advance and are non-refundable except where required by law. You may cancel at any time;
          cancellation takes effect at the end of the current billing period.
        </p>
      </Section>

      <Section heading="4. Payments and Stripe">
        <p>
          Payments are processed by Stripe. Kitchens connect their own Stripe account, and payments
          from a Kitchen&apos;s customers settle to that Kitchen. PrepFlow may collect a platform fee on
          transactions and its software subscription fee. PrepFlow is not a party to the sale of food
          between a Kitchen and its customers. Card processing fees are charged by Stripe at its
          rates. You are responsible for your own taxes, chargebacks, and refunds to your customers.
        </p>
      </Section>

      <Section heading="5. Kitchen responsibilities">
        <p>
          Each Kitchen is solely responsible for its food safety, licensing, allergen and nutritional
          accuracy, labeling, fulfillment, customer service, pricing, and compliance with all laws
          applicable to its business. PrepFlow provides tools to assist (for example, labels and
          allergen fields) but does not verify or guarantee this information.
        </p>
      </Section>

      <Section heading="6. Customer data">
        <p>
          As between you and PrepFlow, a Kitchen owns the data about its own customers. PrepFlow
          processes that data on the Kitchen&apos;s behalf to provide the Service, as described in our{" "}
          <a href="/privacy" style={{ color: "var(--pine)" }}>Privacy Policy</a>. You are responsible
          for having the right to provide any personal data you enter and for your own privacy
          obligations to your customers.
        </p>
      </Section>

      <Section heading="7. Acceptable use">
        <p>
          You agree not to misuse the Service: no unlawful activity, no infringing or harmful
          content, no attempts to breach security or access other tenants&apos; data, no reselling of the
          Service without our consent, and no use that overloads or disrupts the platform.
        </p>
      </Section>

      <Section heading="8. Intellectual property">
        <p>
          PrepFlow and its software are owned by PrepFlow and its licensors. We grant you a limited,
          non-exclusive, non-transferable right to use the Service during your subscription. Your
          business content (menus, branding, customer data) remains yours.
        </p>
      </Section>

      <Section heading="9. Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind, to the
          fullest extent permitted by law. We do not warrant that the Service will be uninterrupted,
          error-free, or fit for a particular purpose.
        </p>
      </Section>

      <Section heading="10. Limitation of liability">
        <p>
          To the fullest extent permitted by law, PrepFlow will not be liable for indirect,
          incidental, special, or consequential damages, or for lost profits, revenue, data, or
          goodwill. Our total liability for any claim relating to the Service will not exceed the
          amounts you paid to PrepFlow in the twelve months before the claim.
        </p>
      </Section>

      <Section heading="11. Indemnification">
        <p>
          You agree to indemnify PrepFlow against claims arising from your use of the Service, your
          content, your sale of food, or your breach of these Terms or applicable law.
        </p>
      </Section>

      <Section heading="12. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for breach
          of these Terms or non-payment. On termination you may request an export of your data for a
          reasonable period, after which it may be deleted.
        </p>
      </Section>

      <Section heading="13. Changes">
        <p>
          We may update these Terms; material changes will be communicated through the Service or by
          email. Continued use after changes take effect constitutes acceptance.
        </p>
      </Section>

      <Section heading="14. Governing law">
        <p>
          These Terms are governed by the laws of the Province of Ontario and the federal laws of
          Canada applicable there, without regard to conflict-of-laws rules. Courts located in
          Ontario have exclusive jurisdiction.
        </p>
      </Section>

      <Section heading="15. Contact">
        <p>Questions about these Terms: {LEGAL_CONTACT}.</p>
      </Section>
    </LegalDoc>
  );
}
