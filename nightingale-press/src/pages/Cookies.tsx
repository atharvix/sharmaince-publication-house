import { PolicyLayout } from '../components/layout/PolicyLayout';
import { useFetch } from '../hooks/useFetch';
import { fetchContentPage } from '../lib/catalogue';
import { cmsSections, formatCmsDate } from '../lib/cms';

export default function Cookies() {
  const { data: cms } = useFetch(() => fetchContentPage('cookies'), []);

  if (cms) {
    return (
      <PolicyLayout
        title={cms.title}
        trail={[{ label: 'Legal', to: '/legal' }, { label: 'Cookie Policy' }]}
        updated={formatCmsDate(cms.updatedAt)}
        intro={cms.intro ? <p>{cms.intro}</p> : undefined}
        sections={cmsSections(cms)}
      />
    );
  }

  return (
    <PolicyLayout
      title="Cookie Policy"
      trail={[{ label: 'Legal', to: '/legal' }, { label: 'Cookie Policy' }]}
      updated="1 October 2026"
      intro={
        <p>
          This policy explains how Nightingale Academic Press uses cookies and similar
          technologies, and the choices available to you.
        </p>
      }
      sections={[
        {
          id: 'what',
          heading: 'What cookies are',
          body: (
            <p>
              Cookies are small text files stored on your device that help a website function and
              remember your preferences between visits.
            </p>
          ),
        },
        {
          id: 'categories',
          heading: 'Categories we use',
          body: (
            <ul>
              <li>Essential: required for core functionality such as the shopping cart and login sessions.</li>
              <li>Preferences: remember choices such as filter selections.</li>
              <li>Analytics: help us understand aggregate usage so we can improve the catalogue and search.</li>
            </ul>
          ),
        },
        {
          id: 'controls',
          heading: 'Managing your preferences',
          body: (
            <p>
              Most browsers let you block or delete cookies through their settings. Blocking
              essential cookies may affect core functionality such as checkout.
            </p>
          ),
        },
      ]}
    />
  );
}
