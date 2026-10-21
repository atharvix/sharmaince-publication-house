import { useMemo, useState } from 'react';
import { fetchFaqs } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { PageHero } from '../components/ui/PageHero';
import { Accordion } from '../components/ui/Accordion';
import { Reveal } from '../components/ui/Reveal';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import styles from './Faqs.module.css';

const TOPIC_LABELS: Record<string, string> = {
  ORDERS: 'Orders',
  DELIVERY: 'Delivery',
  RETURNS: 'Returns',
  SUBMISSIONS: 'Submissions',
  ACCOUNTS: 'Accounts',
};
const TOPICS = ['All', ...Object.keys(TOPIC_LABELS)];

export default function Faqs() {
  const { data: faqs, loading, error, reload } = useFetch(() => fetchFaqs(), []);
  const [topic, setTopic] = useState('All');

  const filtered = useMemo(() => {
    if (!faqs) return [];
    return topic === 'All' ? faqs : faqs.filter((faq) => faq.topic === topic);
  }, [faqs, topic]);

  return (
    <>
      <PageHero
        title="Frequently Asked Questions"
        subtitle="Browse by topic, or scan everything below."
        trail={[{ label: 'Support', to: '/support' }, { label: 'FAQs' }]}
      />
      <div className={`container ${styles.layout}`}>
        <Reveal>
          <div className={styles.tabs} role="tablist" aria-label="FAQ topics">
            {TOPICS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={topic === item}
                className={`${styles.tab} ${topic === item ? styles.tabActive : ''}`.trim()}
                onClick={() => setTopic(item)}
              >
                {item === 'All' ? 'All' : TOPIC_LABELS[item]}
              </button>
            ))}
          </div>
        </Reveal>
        {loading && <LoadingBlock label="Loading FAQs…" />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {faqs && (
          <Reveal delay={60} className={styles.list}>
            <Accordion items={filtered} />
          </Reveal>
        )}
      </div>
    </>
  );
}
