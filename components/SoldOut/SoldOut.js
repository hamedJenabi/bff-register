import FooterCredit from "../../components/FooterCredit/FooterCredit";
import Head from "next/head";
import Link from "next/link";

import styles from "../../styles/StatusPage.module.scss";
import Header from "../Header/Header.js";

export default function SoldOut({ registrationClosed }) {
  const handleRemoveLocalStorage = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accepted_user");
    }
  };
  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2026</title>
        <meta name="description" content="BLUES FEVER 2026 Registration" />
      </Head>
      <Header
        title="BLUES FEVER 2026"
        menuItems={[{ title: "Home", link: "https://www.bluesfever.eu/" }]}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.title}>
            {registrationClosed ? (
              <>
                <h3>We are sold out.</h3>
                <p>hope you make it next year ;) ;)</p>
              </>
            ) : (
              <>
                <h3>Thanks for trying to register for Blues Fever 2026.</h3>
                <p>Unfortunately, all the spots are fully booked.</p>
              </>
            )}
          </div>
          {!registrationClosed && (
            <div className={styles.button}>
              <Link href="/" onClick={handleRemoveLocalStorage}>
                Wanna try another ticket/level?
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <FooterCredit />
      </footer>
    </div>
  );
}
