import { Dialog, DialogBackdrop } from "reakit/Dialog";
import styles from "./Registration.module.scss";

export default function SwitchRoleNotice({ dialog, finalFocusRef }) {
  return <DialogBackdrop {...dialog} className={styles.backdrop} data-animated="false">
    <Dialog {...dialog} className={styles.dialog} data-animated="false" unstable_finalFocusRef={finalFocusRef} aria-label="Choosing Switch">
      <h2>Help keep the class balanced</h2>
      <p>By choosing Switch, you’re happy to dance as either a leader or a follower, helping keep the class balanced.</p>
      <button type="button" className={styles.primary} onClick={dialog.hide}>Got it</button>
    </Dialog>
  </DialogBackdrop>;
}
