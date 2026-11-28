import styles from "./FooterCredit.module.scss";

export default function FooterCredit({ children }) {
  return (
    <div className={styles.footerCredit}>
      {children && <span className={styles.note}>{children}</span>}
      <a href="https://hamedjenabi.me" target="_blank" rel="noreferrer">
        Made with love by Hamed
      </a>
      <a href="https://bluesinvienna.com/dance-app">
        Want this for your event?
      </a>
    </div>
  );
}
