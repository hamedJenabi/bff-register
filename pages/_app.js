import Head from "next/head";
import "../styles/globals.scss";

function MyApp({ Component, pageProps }) {
  return <>
    <Head>
      <link rel="icon" href="/favicon.ico?v=blues-fever-2026" sizes="any" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=blues-fever-2026" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=blues-fever-2026" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=blues-fever-2026" />
    </Head>
    <Component {...pageProps} />
  </>;
}

export default MyApp;
