import { useState, type FormEvent } from 'react';
import { CalendarClock, ReceiptText, Tag, UserRound } from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Reveal } from '../components/ui/Reveal';
import { Button } from '../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../components/ui/FormField';
import { SuccessPanel } from '../components/ui/SuccessPanel';
import { api, ApiError } from '../lib/api';
import styles from './Contact.module.css';

const BENEFITS = [
  { icon: Tag, label: 'Institutional pricing', value: 'Tiered discounts based on order volume, confirmed with a formal quotation.' },
  { icon: ReceiptText, label: 'Consolidated invoicing', value: 'One invoice per order, suitable for purchase-order workflows.' },
  { icon: CalendarClock, label: 'Coordinated delivery', value: 'Delivery scheduled to match your academic calendar.' },
  { icon: UserRound, label: 'A dedicated contact', value: 'One point of contact from quotation through delivery.' },
];

const ORG_TYPE_LABEL: Record<string, string> = {
  college: 'College / University',
  library: 'Library',
  bookstore: 'Bookstore',
  hospital: 'Hospital / Training Centre',
};

export default function BulkOrders() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const orgType = String(form.get('organizationType') ?? '');
      await api.post('/bulk-orders', {
        organizationName: form.get('organizationName'),
        organizationType: ORG_TYPE_LABEL[orgType] ?? orgType,
        contactName: form.get('contactName'),
        email: form.get('email'),
        phone: form.get('phone'),
        deliveryLocation: form.get('deliveryLocation'),
        titlesOfInterest: form.get('titlesOfInterest') || undefined,
        notes: form.get('notes') || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHero
        title="Bulk Orders for Institutions"
        subtitle="For colleges, libraries and bookstores ordering in volume — tell us what you need and our institutional sales team will follow up with a quotation."
        trail={[{ label: 'Bulk Orders' }]}
      />

      <div className="container">
        <div className={styles.layout}>
          <Reveal>
            <div className={styles.infoList}>
              {BENEFITS.map(({ icon: Icon, ...item }) => (
                <div className={styles.infoItem} key={item.label}>
                  <div className={styles.infoIcon} aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className={styles.infoLabel}>{item.label}</p>
                    <p className={styles.infoValue}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={90} className={styles.formCard}>
            {submitted ? (
              <SuccessPanel
                title="Request received"
                body="A member of our institutional sales team will reach out with a quotation, typically within two business days."
                resetLabel="Start another request"
                onReset={() => setSubmitted(false)}
              />
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                  <InputField id="bulk-org" name="organizationName" label="Organization name" required placeholder="e.g. St. Mary's College of Nursing" />
                  <SelectField id="bulk-org-type" name="organizationType" label="Organization type" required defaultValue="">
                    <option value="" disabled>
                      Select a type
                    </option>
                    <option value="college">College / University</option>
                    <option value="library">Library</option>
                    <option value="bookstore">Bookstore</option>
                    <option value="hospital">Hospital / Training Centre</option>
                  </SelectField>
                </div>
                <div className={styles.row}>
                  <InputField id="bulk-contact" name="contactName" label="Contact person" required placeholder="Full name" />
                  <InputField id="bulk-email" name="email" type="email" label="Email address" required placeholder="you@institution.edu" />
                </div>
                <div className={styles.row}>
                  <InputField id="bulk-phone" name="phone" type="tel" label="Phone number" required placeholder="+91" />
                  <InputField id="bulk-location" name="deliveryLocation" label="Delivery location" required placeholder="City, State" />
                </div>
                <InputField
                  id="bulk-books"
                  name="titlesOfInterest"
                  label="Titles or subjects of interest"
                  placeholder="e.g. Foundations of Nursing Practice — 60 copies"
                  hint="List specific titles and quantities if known, or the subjects you need covered."
                />
                <TextareaField id="bulk-notes" name="notes" label="Additional notes" placeholder="Delivery timeline, purchase-order requirements, or anything else we should know." />
                {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
                <Button type="submit" size="lg" variant="primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Request a Quotation'}
                </Button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </>
  );
}
