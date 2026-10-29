import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Button } from '../components/ui/Button';
import { ErrorBlock } from '../components/ui/RequestState';
import { useFetch } from '../hooks/useFetch';
import { fetchCategories, fetchContentPage } from '../lib/catalogue';
import { cmsRichText } from '../lib/cms';
import { subjectColor } from '../lib/subjects';
import styles from './About.module.css';

const SERVICES = [
  { name: 'Publishing', what: 'We support authors and organizations in bringing their manuscripts and educational content to publication with professional care and attention to quality.' },
  { name: 'Distribution', what: 'We make published books available through an organized distribution network, connecting publications with bookstores, institutions, retailers and readers.' },
  { name: 'Author & institutional support', what: 'We work closely with authors, educators and institutions to understand their publishing requirements and provide suitable solutions.' },
  { name: 'Promotion & outreach', what: 'We support the visibility of publications through promotional and outreach activities, helping books reach their intended audiences.' },
];

const MISSION = [
  'To publish quality and meaningful content.',
  'To provide professional support to authors and institutions.',
  'To develop an efficient and reliable distribution network.',
  'To make books accessible to a wider audience.',
  'To build lasting relationships with authors, partners, retailers and readers.',
];

const VALUES = ['Quality', 'Professionalism', 'Reliability', 'Reach', 'Author support'];

const AUDIENCES = [
  { who: 'Students', what: 'Find the edition your course asks for, with pages and price shown up front.', to: '/books', action: 'Browse the catalogue' },
  { who: 'Faculty', what: 'Review a title before adopting it for your class.', to: '/contact?reason=inspection', action: 'Request an inspection copy' },
  { who: 'Institutions', what: 'Order for a college, library or bookstore with a single quote.', to: '/bulk-orders', action: 'Get a bulk quote' },
];

export default function About() {
  const categoriesState = useFetch(() => fetchCategories(), []);

  // The page's own layout is hand-built; CMS content only overrides the title and intro
  // and can append extra sections, so a draft CMS edit never removes the built-in structure.
  const { data: cms } = useFetch(() => fetchContentPage('about'), []);

  return (
    <>
      <PageHero
        title={cms?.title ?? 'About us'}
        subtitle="A publishing and distribution company bringing quality books and educational content to readers through a professional, reliable publishing network."
        trail={[{ label: 'About' }]}
      />

      {cms?.intro && (
        <section className={`container ${styles.section}`}>
          <p className={styles.intro}>{cms.intro}</p>
        </section>
      )}

      <section className={`container ${styles.section}`}>
        <div className={styles.story}>
          <p>
            We work with authors, educators, institutions and publishing partners to turn valuable ideas into well-presented
            publications, and to make them available across diverse markets.
          </p>
          <p>
            Books are more than printed pages. They are how knowledge, creativity, experience and ideas get shared. Our
            publishing and distribution work is built around quality, professionalism, timely service and long-term
            relationships, so that authors, institutions, retailers and readers get a smooth, dependable experience from
            publication to distribution.
          </p>
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <SectionHeading title="What we do" />
        <ol className={styles.services}>
          {SERVICES.map((service) => (
            <li key={service.name} className={styles.service}>
              <h3>{service.name}</h3>
              <p>{service.what}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.purpose}>
          <div>
            <h2 className={styles.purposeTitle}>Our vision</h2>
            <p className={styles.vision}>
              To build a trusted publishing and distribution platform that encourages knowledge, creativity and a strong
              culture of reading.
            </p>
          </div>
          <div>
            <h2 className={styles.purposeTitle}>Our mission</h2>
            <ul className={styles.mission}>
              {MISSION.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <SectionHeading title="Who we publish for" />
        <ul className={styles.audiences}>
          {AUDIENCES.map((audience) => (
            <li key={audience.who} className={styles.audience}>
              <h3>{audience.who}</h3>
              <p>{audience.what}</p>
              <Link to={audience.to} className={styles.audienceLink}>
                {audience.action}
                <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`container ${styles.section}`}>
        <SectionHeading title="What we publish" subtitle="Every subject in the catalogue, with the number of titles in each." />
        {categoriesState.error && <ErrorBlock message={categoriesState.error} onRetry={categoriesState.reload} />}
        {categoriesState.data && (
          <ul className={styles.subjects}>
            {categoriesState.data.map((category) => (
              <li key={category.slug}>
                <Link to={`/books?category=${encodeURIComponent(category.slug)}`} className={styles.subject}>
                  <span className={styles.dot} style={{ background: subjectColor(category.slug) }} aria-hidden="true" />
                  <span className={styles.subjectName}>{category.name}</span>
                  <span className={styles.subjectCount}>
                    {category.bookCount ?? 0} {category.bookCount === 1 ? 'title' : 'titles'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cms && cms.sections.length > 0 && (
        <section className={`container ${styles.section}`}>
          {cms.sections.map((section) => (
            <div key={section.heading} className={styles.cmsSection}>
              <SectionHeading title={section.heading} />
              <div className={styles.cmsBody}>{cmsRichText(section.body)}</div>
            </div>
          ))}
        </section>
      )}

      <section className={`container ${styles.section}`}>
        <div className={styles.contact}>
          <div>
            <h2 className={styles.contactTitle}>Why choose Sharmiance?</h2>
            <ul className={styles.values}>
              {VALUES.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
            <p>
              Every publication is a chance to share knowledge and ideas. We handle every project with care, transparency
              and professionalism, from publishing to distribution.
            </p>
          </div>
          <Button to="/contact" size="md" variant="primary">
            Get in touch
          </Button>
        </div>
      </section>
    </>
  );
}
