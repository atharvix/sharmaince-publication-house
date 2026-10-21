import { PolicyLayout } from '../components/layout/PolicyLayout';
import { useFetch } from '../hooks/useFetch';
import { fetchContentPage } from '../lib/catalogue';
import { cmsSections, formatCmsDate } from '../lib/cms';

export default function Shipping() {
  // CMS content is optional, progressive enhancement: the page renders its own reviewed
  // default copy immediately, then swaps to the admin-published version once it loads (or
  // keeps the default silently if there's no published page — never a blocking spinner or
  // an error banner on a support/legal page).
  const { data: cms } = useFetch(() => fetchContentPage('shipping'), []);

  if (cms) {
    return (
      <PolicyLayout
        title={cms.title}
        trail={[{ label: 'Support', to: '/support' }, { label: 'Shipping' }]}
        updated={formatCmsDate(cms.updatedAt)}
        intro={cms.intro ? <p>{cms.intro}</p> : undefined}
        sections={cmsSections(cms)}
      />
    );
  }

  return (
    <PolicyLayout
      title="Shipping"
      trail={[{ label: 'Support', to: '/support' }, { label: 'Shipping' }]}
      updated="1 October 2026"
      intro={
        <p>
          We currently ship across India through our courier partners. Delivery timelines vary by
          destination and courier serviceability — orders are typically dispatched within 1–2
          business days of payment confirmation.
        </p>
      }
      sections={[
        {
          id: 'regions',
          heading: 'Delivery regions and charges',
          body: (
            <>
              <p>We deliver to all serviceable pin codes across India via our courier partners.</p>
              <ul>
                <li>A flat shipping charge of ₹60 applies per order.</li>
                <li>Shipping is free on orders totalling ₹1,000 or more.</li>
                <li>The exact charge for your order is shown at checkout before payment.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'timelines',
          heading: 'Estimated delivery timelines',
          body: (
            <p>
              Delivery time depends on your location and courier serviceability. Once your order
              is dispatched, the tracking details made available to you will show the most
              accurate estimate for your address.
            </p>
          ),
        },
        {
          id: 'tracking',
          heading: 'Order dispatch and tracking',
          body: (
            <p>
              Once an order is dispatched, a tracking reference is emailed to you and made
              available in your account dashboard. Please allow up to 24 hours for tracking
              information to update after dispatch.
            </p>
          ),
        },
        {
          id: 'institutional',
          heading: 'Institutional and bulk deliveries',
          body: (
            <p>
              Bulk orders are scheduled individually to match institutional requirements. Expected
              delivery windows are confirmed as part of the quotation process — see our{' '}
              Bulk Orders page for details.
            </p>
          ),
        },
      ]}
    />
  );
}
