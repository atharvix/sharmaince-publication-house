import { PolicyLayout } from '../components/layout/PolicyLayout';
import { useFetch } from '../hooks/useFetch';
import { fetchContentPage } from '../lib/catalogue';
import { cmsSections, formatCmsDate } from '../lib/cms';

export default function Privacy() {
  const { data: cms } = useFetch(() => fetchContentPage('privacy'), []);

  if (cms) {
    return (
      <PolicyLayout
        title={cms.title}
        trail={[{ label: 'Legal', to: '/legal' }, { label: 'Privacy Policy' }]}
        updated={formatCmsDate(cms.updatedAt)}
        intro={cms.intro ? <p>{cms.intro}</p> : undefined}
        sections={cmsSections(cms)}
      />
    );
  }

  return (
    <PolicyLayout
      title="Privacy Policy"
      trail={[{ label: 'Legal', to: '/legal' }, { label: 'Privacy Policy' }]}
      updated="1 October 2026"
      intro={
        <p>
          This policy explains what personal data Sharmiance Publication House & Distribution collects, why we
          collect it, how it is used and protected, and the choices available to you. This is a
          sample policy for a public-catalogue preview — final wording requires approval before
          launch.
        </p>
      }
      sections={[
        {
          id: 'data-collected',
          heading: 'Information we collect',
          body: (
            <ul>
              <li>Account information: name, email address and delivery addresses you provide.</li>
              <li>Order information: items purchased, order history and payment status (not raw card details).</li>
              <li>Submission information: details and attachments provided through author or bulk-order forms.</li>
              <li>Usage information: pages visited and search terms, collected in aggregate to improve the catalogue.</li>
            </ul>
          ),
        },
        {
          id: 'use',
          heading: 'How we use this information',
          body: (
            <p>
              We use personal data to process orders, respond to enquiries, manage accounts,
              evaluate author submissions and improve our catalogue and service. We do not sell
              personal data to third parties.
            </p>
          ),
        },
        {
          id: 'sharing',
          heading: 'Sharing and disclosure',
          body: (
            <p>
              We share data only with service providers required to fulfil orders or operate the
              website — such as payment processors and courier partners — and only to the extent
              necessary for that purpose.
            </p>
          ),
        },
        {
          id: 'retention',
          heading: 'Retention and deletion',
          body: (
            <p>
              We retain account and order data for as long as needed to meet legal, accounting and
              operational requirements. Author manuscripts are retained under a separate,
              access-logged retention schedule.
            </p>
          ),
        },
        {
          id: 'rights',
          heading: 'Your rights',
          body: (
            <p>
              You may request access to, correction of, or deletion of your personal data, subject
              to legal and contractual limits, by contacting us through the Contact page.
            </p>
          ),
        },
      ]}
    />
  );
}
