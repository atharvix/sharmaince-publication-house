import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import styles from './NotFound.module.css';

export default function NotFound() {
  return (
    <div className={`container ${styles.wrap}`}>
      <Reveal>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>This page has been reshelved</h1>
        <p className={styles.body}>
          The page you&rsquo;re looking for doesn&rsquo;t exist, or may have moved. Try the
          catalogue, or head back home.
        </p>
        <div className={styles.actions}>
          <Button to="/" variant="outline" size="md">
            Go Home
          </Button>
          <Button to="/books" variant="primary" size="md">
            Browse Books
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
