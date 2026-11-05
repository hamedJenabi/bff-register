import Head from "next/head";

import styles from "../../styles/StatusPage.module.scss";
import Header from "../../components/Header/Header.js";

export default function RegistrationFailed() {
  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2026</title>
        <meta name="description" content="BLUES FEVER 2026 Registration" />
        <link rel="icon" href="/icon.png" />
      </Head>
      <Header
        title="BLUES FEVER 2026"
        menuItems={[{ title: "Home", link: "https://www.bluesfever.eu/" }]}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.title}>
            <h3>Your registration failed.</h3>
            <p>
              Please contact us at{" "}
              <a
                className={styles.contactLink}
                href="mailto:registration@bluesfever.eu"
              >
                registration@bluesfever.eu
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          style={{ width: "auto" }}
          href="https://hamedjenabi.me"
          target="_blank"
          rel="noreferrer"
        >
          Powered with love by Hamed
        </a>
      </footer>
    </div>
  );
}
