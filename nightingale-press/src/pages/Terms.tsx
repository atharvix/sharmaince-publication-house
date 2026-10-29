import { PolicyLayout } from '../components/layout/PolicyLayout';
import { useFetch } from '../hooks/useFetch';
import { fetchContentPage } from '../lib/catalogue';
import { cmsSections, formatCmsDate } from '../lib/cms';

export default function Terms() {
  const { data: cms } = useFetch(() => fetchContentPage('terms'), []);

  if (cms) {
    return (
      <PolicyLayout
        title={cms.title}
        trail={[{ label: 'Legal', to: '/legal' }, { label: 'Terms of Service' }]}
        updated={formatCmsDate(cms.updatedAt)}
        intro={cms.intro ? <p>{cms.intro}</p> : undefined}
        sections={cmsSections(cms)}
      />
    );
  }

  return (
    <PolicyLayout
      title="Terms of Service"
      trail={[{ label: 'Legal', to: '/legal' }, { label: 'Terms of Service' }]}
      updated="1 October 2026"
      intro={
        <p>
          These terms govern your use of this website and any purchases made through it. This is a
          sample policy for a public-catalogue preview — final wording requires legal approval
          before launch.
        </p>
      }
      sections={[
        {
          id: 'accounts',
          heading: 'Accounts',
          body: (
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity under your account.
            </p>
          ),
        },
        {
          id: 'orders',
          heading: 'Orders and pricing',
          body: (
            <p>
              Prices are shown in Indian Rupees and are confirmed at checkout. We reserve the right
              to correct pricing errors and to cancel orders affected by a pricing or stock error,
              with a full refund where payment was already collected.
            </p>
          ),
        },
        {
          id: 'content',
          heading: 'Content and intellectual property',
          body: (
            <p>
              All catalogue content, cover designs and website content are the property of
              Sharmiance Publication House & Distribution or its licensors and may not be reproduced without
              permission.
            </p>
          ),
        },
        {
          id: 'liability',
          heading: 'Limitation of liability',
          body: (
            <p>
              To the extent permitted by law, Sharmiance Publication House & Distribution is not liable for indirect
              or consequential losses arising from use of this website.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          body: (
            <p>
              We may update these terms from time to time. Material changes will be reflected by an
              updated revision date at the top of this page.
            </p>
          ),
        },
      ]}
    />
  );
}
