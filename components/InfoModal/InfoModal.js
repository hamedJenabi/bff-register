import styles from "./InfoModal.module.scss";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import {
  useDialogState,
  Dialog,
  DialogBackdrop,
  DialogDisclosure,
} from "reakit/Dialog";
const InfoModal = ({ header, info, isEarlyBird }) => {
  const dialog = useDialogState();

  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(dialog.visible);
  }, [dialog.visible]);

  return (
    <>
      <DialogDisclosure className={styles.iconContainer} {...dialog}>
        <p style={{ color: "blue" }}>ⓘ</p>
      </DialogDisclosure>
      <DialogBackdrop {...dialog} className={styles.backdrop}>
        <Dialog {...dialog} preventBodyScroll={false}>
          <div
            className={classNames(styles.card, {
              [styles.visible]: show,
            })}
          >
            <div className={styles.closeIconWrapper}>
              <div
                tabIndex={0}
                onClick={dialog.hide}
                className={styles.closeIcon}
              >
                &times;
              </div>
            </div>
            <div className={styles.content}>
              <h3 id="transition-modal-title">{header}</h3>
              <p id="transition-modal-description">{info}</p>
            </div>
          </div>
        </Dialog>
      </DialogBackdrop>
    </>
  );
};
export default InfoModal;
