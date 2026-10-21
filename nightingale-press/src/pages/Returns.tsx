import { PolicyLayout } from '../components/layout/PolicyLayout';
import { useFetch } from '../hooks/useFetch';
import { fetchContentPage } from '../lib/catalogue';
import { cmsSections, formatCmsDate } from '../lib/cms';

export default function Returns() {
  const { data: cms } = useFetch(() => fetchContentPage('returns'), []);

  if (cms) {
    return (
      <PolicyLayout
        title={cms.title}
        trail={[{ label: 'Support', to: '/support' }, { label: 'Returns' }]}
        updated={formatCmsDate(cms.updatedAt)}
        intro={cms.intro ? <p>{cms.intro}</p> : undefined}
        sections={cmsSections(cms)}
      />
    );
  }

  return (
    <PolicyLayout
      title="Returns & Refunds"
      trail={[{ label: 'Support', to: '/support' }, { label: 'Returns' }]}
      updated="1 October 2026"
      intro={
        <p>
          We want every order to arrive correctly and in good condition. If something goes wrong,
          here is how returns and refunds work.
        </p>
      }
      sections={[
        {
          id: 'eligibility',
          heading: 'Eligibility',
          body: (
            <ul>
              <li>Damaged, defective or incorrectly shipped items: reportable within 7 days of delivery.</li>
              <li>Change-of-mind returns: accepted within 7 days of delivery for unused, unmarked copies in original condition.</li>
              <li>Items marked as final sale or custom institutional orders are not eligible for change-of-mind returns.</li>
            </ul>
          ),
        },
        {
          id: 'process',
          heading: 'How to start a return',
          body: (
            <p>
              Contact our support team with your order number and a brief description (and photos,
              for damaged items). We will confirm eligibility and share return instructions within
              2 business days.
            </p>
          ),
        },
        {
          id: 'refunds',
          heading: 'Refund timelines',
          body: (
            <p>
              Approved refunds are issued to the original payment method within 5–7 business days
              of us receiving the returned item. Shipping charges are refunded only for damaged,
              defective or incorrectly shipped items.
            </p>
          ),
        },
        {
          id: 'exclusions',
          heading: 'Exclusions',
          body: (
            <ul>
              <li>Books showing signs of use, writing or damage not present at delivery.</li>
              <li>Digital (e-book) purchases, once access has been granted.</li>
              <li>Negotiated institutional and bulk orders, which follow terms agreed at quotation.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
