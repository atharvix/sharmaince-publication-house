import styles from './StatStrip.module.css';

interface Stat {
  value: string;
  label: string;
}

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className={styles.strip}>
      {stats.map((stat) => (
        <div className={styles.stat} key={stat.label}>
          <p className={styles.value}>{stat.value}</p>
          <p className={styles.label}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
