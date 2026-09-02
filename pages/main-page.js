import Head from "next/head";
import { useEffect, useState } from "react";
import styles from "../styles/MainPage.module.scss";

const baseUrl = "https://www.bluesfever.eu";
const registrationUrl = "https://register.bluesfever.eu/";

const heroSlides = [
  {
    src: "/main-page/605521825_1462960175833729_4447504518076012411_n.jpg",
    alt: "Blues Fever social dance floor with live piano",
  },
  {
    src: "/main-page/604927031_1462960149167065_2037225272272334380_n.jpg",
    alt: "Crowd dancing at Blues Fever",
  },
  {
    src: "/main-page/605490285_1462960075833739_2953087077427330540_n.jpg",
    alt: "Two dancers laughing on the Blues Fever dance floor",
  },
  {
    src: "/main-page/605082577_1458985786231168_5416805863288785355_n.jpg",
    alt: "Blues Fever dancers performing on stage",
  },
  {
    src: "/main-page/605627637_1458985236231223_7903863464635149684_n.jpg",
    alt: "Blues Fever audience with raised hands",
  },
];

const heroImage = `${baseUrl}${heroSlides[0].src}`;

const menuGroups = [
  {
    label: "Festival Infos",
    links: [
      ["Passes & Levels", `${baseUrl}/passes-levels/`],
      ["Schedule & Venues", `${baseUrl}/schedule-venue/`],
      ["Teachers", `${baseUrl}/teachers/`],
      ["Musicians", `${baseUrl}/musicians/`],
    ],
  },
  {
    label: "Competitions",
    links: [
      ["Competition info", `${baseUrl}/competitions/`],
      ["Results 2024", `${baseUrl}/competition-2024/`],
      ["Results 2025", `${baseUrl}/competition-2025/`],
    ],
  },
  {
    label: "Travel Infos",
    links: [
      ["Get to Vienna", `${baseUrl}/get-to-vienna/`],
      ["Welcome to Vienna", `${baseUrl}/around-in-vienna/`],
    ],
  },
  {
    label: "About BFF",
    links: [
      ["BFF Team", `${baseUrl}/bff-team/`],
      ["Terms & Conditions", `${baseUrl}/terms-conditions/`],
      ["Code of Conduct", `${baseUrl}/code-of-conduct/`],
      ["Contact us", `${baseUrl}/contact/`],
    ],
  },
];

const singleMenuLinks = [
  ["Home", `${baseUrl}/`],
  ["Scholarship", `${baseUrl}/scholarship/`],
  ["Previous BFFs", `${baseUrl}/bff-2023/`],
];

const featuredPeople = [
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/adamo-bff.jpeg",
    name: "Adamo Ciarallo",
    role: "Teacher",
    alt: "Adamo Ciarallo",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/alex-scaled.jpeg",
    name: "Alex & Ioanna",
    role: "Teachers",
    alt: "Alex and Ioanna",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2024/07/Bibi-_-Dara-promo-pic.png",
    name: "Beatrice Bibi",
    role: "Teacher",
    alt: "Beatrice Bibi",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2026/06/Image-10-edit-scaled.jpg",
    name: "Dexter Santos",
    role: "Teacher",
    alt: "Dexter Santos dancing",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2025/07/catherine.jpg",
    name: "Catherine Palmier",
    role: "Teacher",
    alt: "Catherine Palmier",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/dan.jpeg",
    name: "Dan Repsch",
    role: "Teacher",
    alt: "Dan Repsch",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2024/07/Bibi_Dara-BAH.jpg",
    name: "Dara Anderbard",
    role: "Teacher",
    alt: "Dara Anderbard",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/jenna.jpeg",
    name: "Jenna Applegarth",
    role: "Teacher",
    alt: "Jenna Applegarth",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2025/07/julie.jpg",
    name: "Julie Brown",
    role: "Teacher",
    alt: "Julie Brown",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2024/07/jamica.jpg",
    name: "Jamica Zion",
    role: "Teacher",
    alt: "Jamica Zion",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/kenneth-bff.jpeg",
    name: "Kenneth Shipp",
    role: "Teacher",
    alt: "Kenneth Shipp",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/mike.webp",
    name: "Mike Sonder",
    role: "Teacher",
    alt: "Mike Sonder",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/07/Vicci-Bff.jpeg",
    name: "Vicci Moore",
    role: "Teacher",
    alt: "Vicci Moore",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2026/07/JontaviousTourPromo.jpg",
    name: "Jontavious Willis",
    role: "Musician",
    alt: "Jontavious Willis",
  },
  {
    src: "https://www.bluesfever.eu/wp-content/uploads/2023/11/janice.jpeg",
    name: "Janice Harrington",
    role: "Musician",
    alt: "Janice Harrington",
  },
];

const needToKnow = [
  {
    number: "01.",
    title: "Passes",
    text: "Full Pass, Party Pass, and Parent Pass options.",
    href: `${baseUrl}/passes-levels/`,
  },
  {
    number: "02.",
    title: "Schedule",
    text: "Classes, talks, parties, and competitions across the weekend.",
    href: `${baseUrl}/schedule-venue/`,
  },
  {
    number: "03.",
    title: "Teachers",
    text: "International Blues teachers and movement voices.",
    href: `${baseUrl}/teachers/`,
  },
  {
    number: "04.",
    title: "Musicians",
    text: "Live bands and late-night Blues energy.",
    href: `${baseUrl}/musicians/`,
  },
  {
    number: "05.",
    title: "Venue",
    text: "Brotfabrik and Superar in Vienna.",
    href: `${baseUrl}/schedule-venue/`,
  },
];

const pathSteps = [
  {
    kicker: "01",
    title: "Pick your pass",
    text: "Choose the weekend shape that fits you: classes, parties, or the parent-friendly option.",
  },
  {
    kicker: "02",
    title: "Build your path",
    text: "Full Pass holders choose five 75-minute classes across the weekend.",
  },
  {
    kicker: "03",
    title: "Dance into the night",
    text: "Live bands, DJs, competitions, talks, and socials carry the festival after class.",
  },
];

export default function MainPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.dataset.bffTheme = "dark";

    return () => {
      delete document.body.dataset.bffTheme;
    };
  }, []);

  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentSlide((slide) => (slide + 1) % heroSlides.length);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={styles.page}>
      <Head>
        <title>Blues Fever Festival 2026 - Vienna</title>
        <meta
          name="description"
          content="Blues Fever Festival returns to Vienna from 10-13 December 2026 with classes, live bands, parties, panel talks, competitions, and social dancing."
        />
        <link rel="canonical" href={`${baseUrl}/`} />
        <meta property="og:title" content="Blues Fever Festival 2026" />
        <meta
          property="og:description"
          content="10-13 December 2026 in Vienna: classes, live music, parties, talks, competitions, and social dancing."
        />
        <meta property="og:image" content={heroImage} />
        <meta property="og:url" content={`${baseUrl}/`} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.nav} aria-label="Festival navigation">
        <a
          className={styles.brand}
          href={baseUrl}
          aria-label="Blues Fever home"
        >
          Blues Fever
        </a>
        <nav className={styles.navLinks} aria-label="Main menu">
          {singleMenuLinks.map(([label, href]) => (
            <a href={href} key={label}>
              {label}
            </a>
          ))}
          {menuGroups.map((group) => (
            <div className={styles.menuGroup} key={group.label}>
              <button type="button">{group.label}</button>
              <div className={styles.menuPanel}>
                {group.links.map(([label, href]) => (
                  <a href={href} key={label}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <a className={styles.navCta} href={registrationUrl}>
          Register
        </a>
        <button
          aria-controls="mobile-menu"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className={styles.menuToggle}
          onClick={() => setMobileMenuOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <nav
          className={`${styles.mobileMenu} ${
            mobileMenuOpen ? styles.mobileMenuOpen : ""
          }`}
          id="mobile-menu"
          aria-label="Mobile menu"
        >
          {singleMenuLinks.map(([label, href]) => (
            <a href={href} key={label} onClick={() => setMobileMenuOpen(false)}>
              {label}
            </a>
          ))}
          {menuGroups.map((group) => (
            <div className={styles.mobileMenuGroup} key={group.label}>
              <strong>{group.label}</strong>
              {group.links.map(([label, href]) => (
                <a
                  href={href}
                  key={label}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </header>

      <main id="top">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroMedia}>
            <div className={styles.slideTrack}>
              {heroSlides.map((slide, index) => (
                <img
                  className={index === currentSlide ? styles.activeSlide : ""}
                  src={slide.src}
                  alt={slide.alt}
                  key={slide.src}
                />
              ))}
            </div>
            <div className={styles.sliderDots} aria-label="Hero images">
              {heroSlides.map((slide, index) => (
                <button
                  aria-label={`Show image ${index + 1}`}
                  aria-pressed={index === currentSlide}
                  className={index === currentSlide ? styles.activeDot : ""}
                  key={slide.src}
                  onClick={() => setCurrentSlide(index)}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>10-13 December 2026 / Vienna</p>
            <h1 id="hero-title">Blues Fever Festival</h1>
            <p className={styles.heroText}>
              A weekend of Blues dancing, live music, classes, talks,
              competitions, and late-night socials.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={registrationUrl}>
                Register here
              </a>
              <a
                className={styles.secondaryButton}
                href={`${baseUrl}/passes-levels/`}
              >
                See passes
              </a>
            </div>
          </div>
        </section>

        <section
          className={styles.knowSection}
          id="know"
          aria-labelledby="know-title"
        >
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>All you need to know</p>
            <h2 id="know-title">One weekend. Five essentials.</h2>
          </div>
          <div className={styles.knowList}>
            {needToKnow.map((item) => (
              <a className={styles.knowItem} href={item.href} key={item.title}>
                <span>{item.number}</span>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.pathSection} id="path">
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Classes</p>
            <h2>Pick your own path.</h2>
            <p>
              The class schedule is built for choice. Full Pass dancers attend
              five 75-minute classes and can shape the weekend around what they
              want to explore.
            </p>
          </div>
          <div className={styles.introGrid}>
            {pathSteps.map((step) => (
              <article className={styles.stepCard} key={step.title}>
                <span>{step.kicker}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.visualSection} id="lineup">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Lineup</p>
            <h2>Teachers, musicians, and deep Blues voices.</h2>
          </div>
          <div
            className={styles.visualBand}
            aria-label="Featured teachers and musicians"
          >
            {featuredPeople.map((person) => (
              <figure className={styles.photoTile} key={person.name}>
                <img src={person.src} alt={person.alt} loading="lazy" />
                <figcaption>
                  <strong>{person.name}</strong>
                  <span>{person.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={styles.valuesSection}>
          <div>
            <p className={styles.eyebrow}>Values</p>
            <h2>Care is part of the dance.</h2>
          </div>
          <div className={styles.valuesCopy}>
            <p>
              Blues Fever centers comfort, consent, and access. Scholarships
              help more dancers join the weekend, and the code of conduct keeps
              the shared space clear.
            </p>
            <div className={styles.inlineActions}>
              <a href={`${baseUrl}/scholarship/`}>Scholarship</a>
              <a href={`${baseUrl}/code-of-conduct/`}>Code of Conduct</a>
            </div>
          </div>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>Registration is open</p>
          <h2>Ready for Blues Fever?</h2>
          <a className={styles.primaryButton} href={registrationUrl}>
            Register here
          </a>
        </section>
      </main>
    </div>
  );
}
