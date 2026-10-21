import { useState, type FormEvent } from 'react';
import { PageHero } from '../components/ui/PageHero';
import { Reveal } from '../components/ui/Reveal';
import { Button } from '../components/ui/Button';
import { InputField, SelectField, TextareaField } from '../components/ui/FormField';
import { SuccessPanel } from '../components/ui/SuccessPanel';
import { api, ApiError } from '../lib/api';
import styles from './Contact.module.css';

const INFO = [
  { icon: '✉', label: 'Email', value: 'hello@nightingalepress.example' },
  { icon: '☎', label: 'Phone', value: '+91 (0) 80-4567-1230' },
  { icon: '📍', label: 'Editorial Office', value: 'MG Road, Bengaluru, Karnataka, India' },
  { icon: '🕐', label: 'Hours', value: 'Mon–Sat, 9:30 AM – 6:00 PM IST' },
];

export default function Contact() {
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
        title="Contact Us"
        subtitle="Questions about an order, a title, or working with us? We read every message."
        trail={[{ label: 'Contact Us' }]}
      />

      <div className="container">
        <div className={styles.layout}>
          <Reveal>
            <div className={styles.infoList}>
              {INFO.map((item) => (
                <div className={styles.infoItem} key={item.label}>
                  <div className={styles.infoIcon} aria-hidden="true">
                    {item.icon}
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
                body="Thank you for reaching out — our team typically responds within one business day."
                resetLabel="Send another message"
                onReset={() => setSubmitted(false)}
              />
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                  <InputField id="contact-name" name="name" label="Full name" required placeholder="Your name" />
                  <InputField id="contact-email" name="email" type="email" label="Email address" required placeholder="you@example.com" />
                </div>
                <SelectField id="contact-reason" name="reason" label="Reason for contact" required defaultValue="">
                  <option value="" disabled>
                    Select a reason
                  </option>
                  <option value="order">Order or delivery question</option>
                  <option value="catalogue">Catalogue or title availability</option>
                  <option value="partnership">Institutional partnership</option>
                  <option value="other">Something else</option>
                </SelectField>
                <TextareaField id="contact-message" name="message" label="Message" required placeholder="How can we help?" />
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
