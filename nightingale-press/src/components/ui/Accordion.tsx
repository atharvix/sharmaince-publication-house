import { useState } from 'react';
import styles from './Accordion.module.css';

export interface AccordionItem {
  question: string;
  answer: string;
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `accordion-panel-${index}`;
        const triggerId = `accordion-trigger-${index}`;
        return (
          <div className={styles.item} data-open={open} key={item.question}>
            <h3>
              <button
                id={triggerId}
                type="button"
                className={styles.trigger}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                {item.question}
                <span className={styles.icon} aria-hidden="true">
                  +
                </span>
              </button>
            </h3>
            <div className={styles.panel} id={panelId} role="region" aria-labelledby={triggerId}>
              <div className={styles.panelInner}>
                <p className={styles.answer}>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
