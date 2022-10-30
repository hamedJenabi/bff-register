import styles from "./Modal.module.scss";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import {
  useDialogState,
  Dialog,
  DialogBackdrop,
  DialogDisclosure,
} from "reakit/Dialog";
import {
  unstable_Form as Form,
  unstable_FormInput as FormInput,
  unstable_FormSubmitButton as FormSubmitButton,
  unstable_useFormState as useFormState,
} from "reakit/Form";
const Modal = ({ user, handleUser, info, form, disabled }) => {
  const dialog = useDialogState();
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(dialog.visible);
  }, [dialog.visible]);

  return (
    <>
      <DialogDisclosure
        {...dialog}
        disabled={disabled}
        className={styles.button}
      >
        {disabled ? "no Change" : "edit"}
      </DialogDisclosure>
      <DialogBackdrop {...dialog} className={styles.backdrop}>
        <Dialog {...dialog} aria-label="edit" preventBodyScroll={false}>
          <Form
            className={classNames(styles.card, {
              [styles.visible]: show,
            })}
            {...form}
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
              <h3 id="transition-modal-title">{info}</h3>
              <FormInput
                required
                {...form}
                label={info}
                className={styles.input}
                name={info}
                placeholder={info}
              />
              <FormSubmitButton
                className={styles.submit}
                // onClick={() => handleUser(user.first_name)}
                {...form}
              >
                Submit
              </FormSubmitButton>
            </div>
          </Form>
        </Dialog>
      </DialogBackdrop>
    </>
  );
};
export default Modal;
