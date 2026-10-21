import { PageHero } from '../components/ui/PageHero';
import { HubLinks } from '../components/ui/HubLinks';
import { Reveal } from '../components/ui/Reveal';

const LINKS = [
  { to: '/faqs', icon: '❓', title: 'FAQs', description: 'Answers to common questions about orders, delivery, returns and submissions.' },
  { to: '/shipping', icon: '🚚', title: 'Shipping', description: 'Delivery regions, charges, estimated timelines and tracking.' },
  { to: '/returns', icon: '↩', title: 'Returns', description: 'Eligibility, process and timelines for returns and refunds.' },
  { to: '/contact', icon: '✉', title: 'Contact Us', description: "Can't find an answer? Reach our support team directly." },
];

export default function Support() {
  return (
    <>
      <PageHero
        title="Support Centre"
        subtitle="Everything you need to track an order, understand our policies, or get in touch."
        trail={[{ label: 'Support' }]}
      />
      <div className="container" style={{ paddingBlock: 'var(--space-8) var(--space-9)' }}>
        <Reveal>
          <HubLinks links={LINKS} />
        </Reveal>
      </div>
    </>
  );
}
