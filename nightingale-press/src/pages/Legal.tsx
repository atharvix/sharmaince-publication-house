import { PageHero } from '../components/ui/PageHero';
import { HubLinks } from '../components/ui/HubLinks';
import { Reveal } from '../components/ui/Reveal';
import { Cookie, FileText, ShieldCheck } from 'lucide-react';

const LINKS = [
  { to: '/legal/privacy', icon: ShieldCheck, title: 'Privacy Policy', description: 'What data we collect, why, and the choices available to you.' },
  { to: '/legal/terms', icon: FileText, title: 'Terms of Service', description: 'The terms that govern use of our website and purchases.' },
  { to: '/legal/cookies', icon: Cookie, title: 'Cookie Policy', description: 'How we use cookies and how to manage your preferences.' },
];

export default function Legal() {
  return (
    <>
      <PageHero
        title="Legal"
        subtitle="Our policies, in plain language wherever possible."
        trail={[{ label: 'Legal' }]}
      />
      <div className="container" style={{ paddingBlock: 'var(--space-8) var(--space-9)' }}>
        <Reveal>
          <HubLinks links={LINKS} />
        </Reveal>
      </div>
    </>
  );
}
