import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Service Description',
    content: `CleanSlate Media ("CleanSlate", "we", "our", "us") operates a media buyback service. We purchase used books, CDs, DVDs, Blu-rays, and video games from individuals. Our service includes providing price quotes, generating prepaid shipping labels, grading received items, and issuing payments.`,
  },
  {
    title: 'Eligibility',
    content: `To use CleanSlate, you must:

- Be at least 18 years of age
- Be a legal resident of the United States
- Legally own the items you are selling to us
- Have authority to sell the items (items must not be stolen, rented, or borrowed)

By submitting an order, you represent and warrant that all items you send to us are legally owned by you and free of any liens or encumbrances.`,
  },
  {
    title: 'Quotes and Pricing',
    content: `The price quotes provided through our website are estimates based on current market conditions at the time of the quote. Quotes are not guaranteed and are subject to change.

- Quotes are valid for 14 days from the date they are generated
- Final payout may differ from the quoted price after our team inspects and grades your items
- Market fluctuations, condition discrepancies, or missing components may result in an adjusted offer
- We reserve the right to decline any item that does not meet our acceptance criteria`,
  },
  {
    title: 'Shipping',
    content: `We provide a free prepaid USPS shipping label for all accepted orders.

- You are responsible for securely packing your items to prevent damage during transit
- Items damaged due to inadequate packing may receive a reduced offer or be rejected
- We recommend using the original packaging or a sturdy box with appropriate cushioning
- CleanSlate is not responsible for items lost or damaged by the carrier during transit
- Shipping labels must be used within 14 days of generation`,
  },
  {
    title: 'Grading and Inspection',
    content: `Upon receiving your package, our team will inspect and grade each item based on our published condition guidelines.

- Grading is performed within 1-3 business days of receiving your package
- If the actual condition differs from what was reported at the time of the quote, we may adjust the offer accordingly
- Items that do not meet our minimum acceptance criteria will be rejected
- Our grading decisions are final`,
  },
  {
    title: 'Payment',
    content: `Payment is issued within 2-3 business days after grading is complete.

- Payment will be sent to the method you selected at checkout (PayPal, Venmo, or Zelle)
- You are responsible for providing accurate payout information
- If we are unable to deliver payment due to incorrect information, we will attempt to contact you via email
- Unclaimed payments will be held for 90 days, after which the order may be closed`,
  },
  {
    title: 'Rejected Items',
    content: `Items that are rejected during grading (due to condition, ineligibility, or other reasons) cannot be returned.

- Rejected items will be donated to charitable organizations or responsibly recycled
- By submitting an order, you acknowledge and agree that rejected items will not be returned to you
- If a significant portion of your order is rejected, we will notify you via email`,
  },
  {
    title: 'Limitation of Liability',
    content: `To the fullest extent permitted by law, CleanSlate Media shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our service.

Our total liability for any claim arising from or related to the service shall not exceed the total payout amount of the order in question.

We make no warranties, express or implied, regarding the accuracy of our quotes, the availability of our service, or the condition of items after shipping.`,
  },
  {
    title: 'Intellectual Property',
    content: `All content on the CleanSlate website, including text, graphics, logos, and software, is the property of CleanSlate Media and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from our content without express written permission.`,
  },
  {
    title: 'Modifications to Terms',
    content: `We reserve the right to modify these Terms of Service at any time. Changes will be effective upon posting to our website with an updated "Last updated" date.

Your continued use of CleanSlate after changes are posted constitutes acceptance of the modified terms. We encourage you to review these terms periodically.`,
  },
  {
    title: 'Governing Law',
    content: `These Terms of Service are governed by and construed in accordance with the laws of the United States. Any disputes arising from these terms or your use of our service shall be resolved through good-faith negotiation or, if necessary, through the appropriate courts.`,
  },
  {
    title: 'Contact',
    content: `If you have questions about these Terms of Service, please contact us:

Email: support@cleanslatemedia.com`,
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-[var(--spacing-page)] py-8">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-700 mb-6 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to home
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <FileText size={24} className="text-brand-600" />
          <h1 className="font-display font-bold text-2xl text-text-primary">
            Terms of Service
          </h1>
        </div>
        <p className="text-sm text-text-muted">
          Last updated: April 7, 2026
        </p>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          Please read these Terms of Service carefully before using CleanSlate Media.
          By accessing or using our service, you agree to be bound by these terms.
          If you do not agree, please do not use our service.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((section, i) => (
          <section key={i}>
            <h2 className="font-display font-semibold text-lg text-text-primary mb-3">
              {i + 1}. {section.title}
            </h2>
            <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {section.content}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
