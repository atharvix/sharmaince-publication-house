import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { SITE_CONTACT } from '../lib/site';
import { PageHero } from '../components/ui/PageHero';
import { Reveal } from '../components/ui/Reveal';
import { Button } from '../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../components/ui/FormField';
import { SuccessPanel } from '../components/ui/SuccessPanel';
import { api, ApiError } from '../lib/api';
import styles from './Contact.module.css';

const INFO = [
  { icon: Mail, label: 'Email', value: SITE_CONTACT.email },
  { icon: Phone, label: 'Phone', value: SITE_CONTACT.phone },
  { icon: MapPin, label: 'Editorial office', value: SITE_CONTACT.office },
  { icon: Clock, label: 'Hours', value: SITE_CONTACT.hours },
];

const REASONS = ['order', 'catalogue', 'inspection', 'partnership', 'other'];

export default function Contact() {
  const [searchParams] = useSearchParams();
  // Book pages link here as ?reason=inspection&title=… so faculty don't retype the title.
  const presetReason = REASONS.includes(searchParams.get('reason') ?? '') ? searchParams.get('reason')! : '';
  const presetTitle = searchParams.get('title');
  const presetMessage = presetReason === 'inspection' && presetTitle ? `I'd like an inspection copy of "${presetTitle}" for my course.` : '';
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/contact', {
        name: form.get('name'),
        email: form.get('email'),
        reason: form.get('reason'),
        message: form.get('message'),
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
        title="Contact us"
        subtitle="Questions about an order, a title, or working with us? Send a message and we'll reply by email."
        trail={[{ label: 'Contact' }]}
      />

      <div className="container">
        <div className={styles.layout}>
          <Reveal>
            <div className={styles.infoList}>
              {INFO.map(({ icon: Icon, ...item }) => (
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
                title="Message sent"
                body="Thanks for getting in touch. We'll reply to the email address you gave."
                resetLabel="Send another message"
                onReset={() => setSubmitted(false)}
              />
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                  <InputField id="contact-name" name="name" label="Full name" required placeholder="Your name" />
                  <InputField id="contact-email" name="email" type="email" label="Email address" required placeholder="you@example.com" />
                </div>
                <SelectField id="contact-reason" name="reason" label="Reason for contact" required defaultValue={presetReason}>
                  <option value="" disabled>
                    Select a reason
                  </option>
                  <option value="order">Order or delivery question</option>
                  <option value="catalogue">Catalogue or title availability</option>
                  <option value="inspection">Inspection copy for a course</option>
                  <option value="partnership">Institutional partnership</option>
                  <option value="other">Something else</option>
                </SelectField>
                <TextareaField id="contact-message" name="message" label="Message" required placeholder="How can we help?" defaultValue={presetMessage} />
                {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
                <Button type="submit" size="lg" variant="primary" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Message'}
                </Button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </>
  );
}
