import { isTicketRegistrationClosed } from "../../lib/ticket-registration";

export { default } from "../../components/SoldOut/SoldOut";

export function getServerSideProps() {
  return { props: { registrationClosed: isTicketRegistrationClosed() } };
}
