import styles from "./Card.module.scss";
import React from "react";

const Card = ({ children }) => <div className={styles.card}>{children}</div>;
export default Card;
